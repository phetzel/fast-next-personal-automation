"""Job service (PostgreSQL async).

Contains business logic for job operations. Uses job repository for database access.
"""

import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cover_letter_pdf import (
    ContactInfo,
    generate_cover_letter_filename,
    generate_cover_letter_pdf,
)
from app.core.exceptions import NotFoundError, ValidationError
from app.core.storage import get_storage_instance
from app.db.models.job import Job, JobStatus
from app.db.models.job_profile import JobProfile
from app.db.models.user import User
from app.repositories import job_profile_repo, job_repo
from app.schemas.job import JobFilters, JobUpdate, ManualJobCreateRequest
from app.schemas.job_data import RawJob  # Unified job data model

logger = logging.getLogger(__name__)

_STATUS_TRANSITIONS: dict[JobStatus, set[JobStatus]] = {
    JobStatus.NEW: {JobStatus.ANALYZED, JobStatus.APPLIED},
    JobStatus.ANALYZED: {JobStatus.PREPPED, JobStatus.APPLIED},
    JobStatus.PREPPED: {JobStatus.REVIEWED, JobStatus.APPLIED},
    JobStatus.REVIEWED: {JobStatus.APPLIED},
    JobStatus.APPLIED: {JobStatus.INTERVIEWING, JobStatus.REJECTED},
    JobStatus.INTERVIEWING: {JobStatus.REJECTED},
    JobStatus.REJECTED: set(),
}

_APPLICATION_ANALYSIS_FIELDS = (
    "application_type",
    "application_url",
    "requires_cover_letter",
    "requires_resume",
    "detected_fields",
    "screening_questions",
)


@dataclass
class IngestionResult:
    """Result from job ingestion."""

    jobs_received: int = 0
    jobs_analyzed: int = 0
    jobs_saved: int = 0
    duplicates_skipped: int = 0
    high_scoring: int = 0  # Jobs with score >= 7.0
    saved_jobs: list[Job] | None = None  # Optionally include saved job objects


class JobService:
    """Service for job-related business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, job_id: UUID, user_id: UUID) -> Job:
        """Get job by ID for a specific user.

        Raises:
            NotFoundError: If job does not exist or doesn't belong to user.
        """
        job = await job_repo.get_by_id_and_user(self.db, job_id, user_id)
        if not job:
            raise NotFoundError(
                message="Job not found",
                details={"job_id": str(job_id)},
            )
        return job

    async def get_by_user(
        self,
        user_id: UUID,
        filters: JobFilters | None = None,
    ) -> tuple[list[Job], int]:
        """Get paginated jobs for a user with optional filters."""
        if filters is None:
            filters = JobFilters()
        return await job_repo.get_by_user(self.db, user_id, filters)

    async def get_stats(self, user_id: UUID) -> dict:
        """Get job statistics for a user."""
        return await job_repo.get_stats(self.db, user_id)

    def _validate_status_transition(
        self,
        current_status: JobStatus,
        new_status: JobStatus,
    ) -> None:
        """Validate lifecycle transitions, allowing idempotent writes."""
        if current_status == new_status:
            return

        allowed_targets = _STATUS_TRANSITIONS[current_status]
        if new_status not in allowed_targets:
            raise ValidationError(
                message=f"Invalid job status transition: {current_status.value} -> {new_status.value}",
                details={
                    "current_status": current_status.value,
                    "requested_status": new_status.value,
                    "allowed_statuses": sorted(status.value for status in allowed_targets),
                },
            )

    @staticmethod
    def _append_notes(existing: str | None, new_notes: str | None) -> str | None:
        """Append notes while preserving any existing text."""
        if not new_notes:
            return existing
        if not existing:
            return new_notes
        return f"{existing}\n\n{new_notes}".strip()

    @staticmethod
    def _apply_status_side_effects(
        current_status: JobStatus,
        next_status: JobStatus,
        *,
        existing_applied_at: datetime | None,
        update_data: dict[str, Any],
    ) -> None:
        """Populate lifecycle timestamps when status changes imply them."""
        if next_status == JobStatus.APPLIED and current_status != JobStatus.APPLIED:
            update_data["applied_at"] = existing_applied_at or datetime.now(UTC)

    async def update(
        self,
        job_id: UUID,
        user_id: UUID,
        job_in: JobUpdate,
    ) -> Job:
        """Update a job.

        Raises:
            NotFoundError: If job does not exist or doesn't belong to user.
        """
        job = await self.get_by_id(job_id, user_id)
        update_data = job_in.model_dump(exclude_unset=True)
        if update_data.get("status") is not None:
            next_status = update_data["status"]
            current_status = JobStatus(job.status)
            self._validate_status_transition(current_status, next_status)
            self._apply_status_side_effects(
                current_status,
                next_status,
                existing_applied_at=job.applied_at,
                update_data=update_data,
            )
            update_data["status"] = next_status.value
        return await job_repo.update(self.db, db_job=job, update_data=update_data)

    async def update_status(
        self,
        job_id: UUID,
        user_id: UUID,
        status: JobStatus,
    ) -> Job:
        """Update job status.

        Raises:
            NotFoundError: If job does not exist or doesn't belong to user.
        """
        job = await self.get_by_id(job_id, user_id)
        current_status = JobStatus(job.status)
        self._validate_status_transition(current_status, status)
        update_data: dict[str, Any] = {"status": status.value}
        self._apply_status_side_effects(
            current_status,
            status,
            existing_applied_at=job.applied_at,
            update_data=update_data,
        )
        return await job_repo.update(
            self.db,
            db_job=job,
            update_data=update_data,
        )

    async def delete(self, job_id: UUID, user_id: UUID) -> Job:
        """Delete a job.

        Raises:
            NotFoundError: If job does not exist or doesn't belong to user.
        """
        job = await job_repo.delete(self.db, job_id, user_id)
        if not job:
            raise NotFoundError(
                message="Job not found",
                details={"job_id": str(job_id)},
            )
        return job

    async def create_from_scrape(
        self,
        user_id: UUID,
        jobs_data: list[dict],
    ) -> list[Job]:
        """Create multiple jobs from pipeline scrape results.

        Skips duplicates based on job_url per user.
        """
        return await job_repo.create_bulk(self.db, user_id, jobs_data)

    async def check_duplicate(self, user_id: UUID, job_url: str) -> bool:
        """Check if a job URL already exists for user."""
        existing = await job_repo.get_by_url_and_user(self.db, job_url, user_id)
        return existing is not None

    async def ingest_jobs(
        self,
        user_id: UUID,
        jobs: list[RawJob],
        *,
        ingestion_source: Literal["scrape", "email", "manual", "openclaw"],
        profile_id: UUID | None = None,
        search_terms: str | None = None,
        external_analysis_by_url: dict[str, dict[str, Any]] | None = None,
        job_attributes_by_url: dict[str, dict[str, Any]] | None = None,
    ) -> IngestionResult:
        """Ingest jobs from an external or manual source without internal scoring."""
        result = IngestionResult(jobs_received=len(jobs))
        external_analysis_by_url = external_analysis_by_url or {}
        job_attributes_by_url = job_attributes_by_url or {}

        if not jobs:
            return result

        # Step 1: Filter out duplicates
        new_jobs: list[RawJob] = []
        for job in jobs:
            existing = await job_repo.get_by_url_and_user(self.db, job.job_url, user_id)
            if existing:
                result.duplicates_skipped += 1
            else:
                new_jobs.append(job)

        if not new_jobs:
            return result

        # Step 2: Persist any external analysis that arrived with the jobs.
        jobs_to_save: list[dict] = []
        for raw_job in new_jobs:
            job_data = {
                "title": raw_job.title,
                "company": raw_job.company,
                "location": raw_job.location,
                "description": raw_job.description,
                "job_url": raw_job.job_url,
                "salary_range": raw_job.salary_range,
                "date_posted": raw_job.date_posted,
                "source": raw_job.source,
                "ingestion_source": ingestion_source,
                "is_remote": raw_job.is_remote,
                "job_type": raw_job.job_type,
                "company_url": raw_job.company_url,
                "profile_id": profile_id,
                "search_terms": search_terms,
            }

            external_analysis = external_analysis_by_url.get(raw_job.job_url)
            if isinstance(external_analysis, dict):
                external_score_raw = external_analysis.get("relevance_score")
                if isinstance(external_score_raw, (int, float)) and not isinstance(
                    external_score_raw, bool
                ):
                    external_score = float(external_score_raw)
                    job_data["relevance_score"] = external_score
                    result.jobs_analyzed += 1
                    if external_score >= 7.0:
                        result.high_scoring += 1

                external_reasoning = external_analysis.get("reasoning")
                if external_reasoning is None or isinstance(external_reasoning, str):
                    job_data["reasoning"] = external_reasoning

            extra_attributes = job_attributes_by_url.get(raw_job.job_url, {})
            if extra_attributes:
                job_data.update(extra_attributes)

            jobs_to_save.append(job_data)

        if jobs_to_save:
            saved = await job_repo.create_bulk(self.db, user_id, jobs_to_save)
            result.jobs_saved = len(saved)
            result.saved_jobs = saved

        logger.info(
            f"Ingested {result.jobs_received} jobs: "
            f"{result.duplicates_skipped} duplicates, "
            f"{result.jobs_analyzed} analyzed, "
            f"{result.jobs_saved} saved"
        )

        return result

    async def create_manual_job(
        self,
        user_id: UUID,
        job_in: ManualJobCreateRequest,
    ) -> Job:
        """Create a manually entered job without internal scoring."""
        if job_in.profile_id is not None:
            profile = await job_profile_repo.get_by_id(self.db, job_in.profile_id)
            if profile is None or profile.user_id != user_id:
                raise ValidationError(message="Selected profile not found or access denied")

        if await self.check_duplicate(user_id, job_in.job_url):
            raise ValidationError(
                message="A job with this URL already exists",
                details={"job_url": job_in.job_url},
            )

        job = await job_repo.create(
            self.db,
            user_id=user_id,
            title=job_in.title,
            company=job_in.company,
            job_url=job_in.job_url,
            profile_id=job_in.profile_id,
            location=job_in.location,
            description=job_in.description,
            salary_range=job_in.salary_range,
            date_posted=job_in.date_posted,
            source=job_in.source,
            ingestion_source="manual",
            is_remote=job_in.is_remote,
            job_type=job_in.job_type,
            company_url=job_in.company_url,
        )
        if job_in.notes:
            job = await job_repo.update(
                self.db,
                db_job=job,
                update_data={"notes": job_in.notes},
            )
        return job

    async def manual_analyze(
        self,
        job_id: UUID,
        user_id: UUID,
        *,
        requires_cover_letter: bool = False,
        screening_questions: list[str] | None = None,
    ) -> Job:
        """Mark a job ready for prep with user-provided manual analysis."""
        job = await self.get_by_id(job_id, user_id)
        current_status = JobStatus(job.status)
        if current_status not in {JobStatus.NEW, JobStatus.ANALYZED}:
            raise ValidationError(
                message="Manual analyze is only available for new or analyzed jobs",
                details={
                    "job_id": str(job_id),
                    "status": current_status.value,
                },
            )

        normalized_questions = [
            {"question": question.strip()}
            for question in (screening_questions or [])
            if question.strip()
        ]

        return await self.update_application_analysis(
            job_id,
            user_id,
            application_type=job.application_type or "unknown",
            application_url=job.application_url or job.job_url,
            requires_cover_letter=requires_cover_letter,
            screening_questions=normalized_questions,
        )

    async def update_application_analysis(
        self,
        job_id: UUID,
        user_id: UUID,
        *,
        description: str | None = None,
        application_type: str | None = None,
        application_url: str | None = None,
        requires_cover_letter: bool | None = None,
        requires_resume: bool | None = None,
        detected_fields: dict[str, Any] | None = None,
        screening_questions: list[dict[str, Any]] | None = None,
        analyzed_at: datetime | None = None,
    ) -> Job:
        """Persist application-page analysis and advance NEW jobs to ANALYZED."""
        job = await self.get_by_id(job_id, user_id)

        update_data: dict[str, Any] = {}
        if description is not None:
            update_data["description"] = description
        if application_type is not None:
            update_data["application_type"] = application_type
        if application_url is not None:
            update_data["application_url"] = application_url
        if requires_cover_letter is not None:
            update_data["requires_cover_letter"] = requires_cover_letter
        if requires_resume is not None:
            update_data["requires_resume"] = requires_resume
        if detected_fields is not None:
            update_data["detected_fields"] = detected_fields
        if screening_questions is not None:
            update_data["screening_questions"] = screening_questions

        has_analysis_payload = any(field in update_data for field in _APPLICATION_ANALYSIS_FIELDS)
        if not has_analysis_payload:
            raise ValidationError(
                message="At least one application analysis field is required",
                details={"required_fields": list(_APPLICATION_ANALYSIS_FIELDS)},
            )

        update_data["analyzed_at"] = analyzed_at or datetime.now(UTC)

        current_status = JobStatus(job.status)
        if current_status == JobStatus.NEW:
            update_data["status"] = JobStatus.ANALYZED.value

        return await job_repo.update(self.db, db_job=job, update_data=update_data)

    async def mark_job_applied(
        self,
        job_id: UUID,
        user_id: UUID,
        *,
        application_method: str | None = None,
        confirmation_code: str | None = None,
        applied_at: datetime | None = None,
        notes: str | None = None,
    ) -> Job:
        """Mark a reviewed job as applied, allowing idempotent updates."""
        job = await self.get_by_id(job_id, user_id)
        current_status = JobStatus(job.status)
        if current_status != JobStatus.APPLIED:
            self._validate_status_transition(current_status, JobStatus.APPLIED)

        update_data: dict[str, Any] = {
            "status": JobStatus.APPLIED.value,
            "applied_at": applied_at or job.applied_at or datetime.now(UTC),
        }
        if application_method is not None:
            update_data["application_method"] = application_method
        if confirmation_code is not None:
            update_data["confirmation_code"] = confirmation_code
        if notes is not None:
            update_data["notes"] = self._append_notes(job.notes, notes)

        return await job_repo.update(self.db, db_job=job, update_data=update_data)

    async def generate_cover_letter_pdf(
        self,
        job_id: UUID,
        user: User,
        profile: JobProfile | None = None,
    ) -> Job:
        """Generate a PDF from the job's cover letter and store it in S3.

        This should be called after the user has reviewed/edited the cover letter.
        The PDF will be stored with a professional filename for easy uploading
        to job application portals.

        Args:
            job_id: The job ID
            user: The authenticated user (for name/email in the letter)
            profile: Optional job profile to get contact info from

        Returns:
            The updated job with cover_letter_file_path set

        Raises:
            NotFoundError: If job doesn't exist or doesn't belong to user
            ValidationError: If job has no cover letter text to convert
        """
        job = await self.get_by_id(job_id, user.id)

        # Validate that we have a cover letter to convert
        if not job.cover_letter:
            raise ValidationError(
                message="Job has no cover letter to convert to PDF",
                details={"job_id": str(job_id)},
            )

        # Build contact info with fallback chain: profile -> user -> defaults
        contact_info = self._build_contact_info(user, profile)

        # Generate the PDF
        pdf_bytes = generate_cover_letter_pdf(
            cover_letter_text=job.cover_letter,
            contact_info=contact_info,
            company_name=job.company,
            job_title=job.title,
        )

        # Generate professional filename
        filename = generate_cover_letter_filename(
            company=job.company,
            job_title=job.title,
            applicant_name=contact_info.full_name,
        )

        # Store in S3
        storage = await get_storage_instance()
        file_path = await storage.save(
            file_data=pdf_bytes,
            user_id=user.id,
            filename=filename,
            subdir="cover_letters",
        )

        # Update job record
        now = datetime.now(UTC)
        updated_job = await job_repo.update(
            self.db,
            db_job=job,
            update_data={
                "cover_letter_file_path": file_path,
                "cover_letter_generated_at": now,
            },
        )

        logger.info(f"Generated cover letter PDF for job {job_id}: {file_path}")

        return updated_job

    def _build_contact_info(
        self,
        user: User,
        profile: JobProfile | None = None,
    ) -> ContactInfo:
        """Build ContactInfo from profile and user with fallback chain.

        Priority: profile contact fields -> user fields -> sensible defaults
        """
        # Name: profile -> user -> email prefix
        full_name = None
        if profile and profile.contact_full_name:
            full_name = profile.contact_full_name
        elif user.full_name:
            full_name = user.full_name
        else:
            # Last resort: use email prefix but capitalize
            email_prefix = user.email.split("@")[0]
            # Try to convert underscores/dots to spaces and title case
            full_name = email_prefix.replace("_", " ").replace(".", " ").title()

        # Email: profile -> user
        email = profile.contact_email if profile and profile.contact_email else user.email

        # Phone: profile only
        phone = profile.contact_phone if profile else None

        # Location: profile only
        location = profile.contact_location if profile else None

        # Website: profile only
        website = profile.contact_website if profile else None

        return ContactInfo(
            full_name=full_name,
            phone=phone,
            email=email,
            location=location,
            website=website,
        )

    async def get_cover_letter_pdf(
        self,
        job_id: UUID,
        user_id: UUID,
    ) -> tuple[bytes, str]:
        """Retrieve the cover letter PDF for a job.

        Args:
            job_id: The job ID
            user_id: The user ID for ownership verification

        Returns:
            Tuple of (pdf_bytes, filename) - filename is clean without storage UUID prefix

        Raises:
            NotFoundError: If job doesn't exist or doesn't belong to user
            ValidationError: If no PDF has been generated yet
        """
        job = await self.get_by_id(job_id, user_id)

        if not job.cover_letter_file_path:
            raise ValidationError(
                message="No cover letter PDF has been generated for this job",
                details={"job_id": str(job_id)},
            )

        # Load from storage
        storage = await get_storage_instance()
        try:
            pdf_bytes = await storage.load(job.cover_letter_file_path)
        except FileNotFoundError as e:
            raise ValidationError(
                message="Cover letter PDF file not found in storage",
                details={"file_path": job.cover_letter_file_path},
            ) from e

        # Generate a clean filename without the storage UUID prefix
        # This requires us to get the user's profile for name
        profile = await job_profile_repo.get_default_for_user(self.db, user_id)

        # Get user for name fallback
        from app.repositories import user_repo

        user = await user_repo.get_by_id(self.db, user_id)

        if user:
            contact_info = self._build_contact_info(user, profile)
            filename = generate_cover_letter_filename(
                company=job.company,
                job_title=job.title,
                applicant_name=contact_info.full_name,
            )
        else:
            # Fallback to extracting from path (with UUID prefix)
            filename = job.cover_letter_file_path.split("/")[-1]

        return pdf_bytes, filename

    async def regenerate_cover_letter_pdf(
        self,
        job_id: UUID,
        user: User,
    ) -> Job:
        """Regenerate the cover letter PDF using the user's default profile.

        This is useful after editing the cover letter text. It looks up
        the user's default job profile to get contact info.

        Args:
            job_id: The job ID
            user: The authenticated user

        Returns:
            The updated job with new cover_letter_file_path

        Raises:
            NotFoundError: If job doesn't exist or doesn't belong to user
            ValidationError: If job has no cover letter text
        """
        # Get default profile for contact info
        profile = await job_profile_repo.get_default_for_user(self.db, user.id)

        return await self.generate_cover_letter_pdf(job_id, user, profile)

    async def delete_by_status(
        self,
        user_id: UUID,
        status: JobStatus,
    ) -> int:
        """Soft delete all jobs with a given status.

        Sets deleted_at timestamp for all matching jobs, removing them from
        listings while preserving records for duplicate checking.

        Args:
            user_id: User ID
            status: Status of jobs to delete (e.g., NEW, PREPPED, REVIEWED)

        Returns:
            Count of jobs deleted
        """
        return await job_repo.soft_delete_by_status(self.db, user_id, status)
