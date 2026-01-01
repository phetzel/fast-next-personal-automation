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
from app.schemas.job import JobFilters, JobUpdate

logger = logging.getLogger(__name__)


@dataclass
class RawJob:
    """Common job data structure for ingestion from any source.

    Can be created from ScrapedJob (scraper) or ExtractedJob (email parser).
    """

    title: str
    company: str
    job_url: str
    location: str | None = None
    description: str | None = None
    salary_range: str | None = None
    date_posted: datetime | None = None
    source: str | None = None  # linkedin, indeed, etc.
    is_remote: bool | None = None
    job_type: str | None = None
    company_url: str | None = None

    @classmethod
    def from_scraped(cls, job) -> "RawJob":
        """Create from a ScrapedJob (job search pipeline)."""
        return cls(
            title=job.title,
            company=job.company,
            job_url=job.job_url,
            location=job.location,
            description=job.description,
            salary_range=job.salary_range,
            date_posted=job.date_posted,
            source=job.source,
            is_remote=getattr(job, "is_remote", None),
            job_type=getattr(job, "job_type", None),
            company_url=getattr(job, "company_url", None),
        )

    @classmethod
    def from_extracted(cls, job, source_override: str | None = None) -> "RawJob":
        """Create from an ExtractedJob (email parser)."""
        return cls(
            title=job.title,
            company=job.company,
            job_url=job.job_url,
            location=job.location,
            description=getattr(job, "description_snippet", None),
            salary_range=job.salary_range,
            source=source_override or job.source,
        )


@dataclass
class IngestionResult:
    """Result from job ingestion."""

    jobs_received: int = 0
    jobs_analyzed: int = 0
    jobs_saved: int = 0
    duplicates_skipped: int = 0
    high_scoring: int = 0  # Jobs with score >= min_score
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
        # Convert enum to value if present
        if update_data.get("status"):
            update_data["status"] = update_data["status"].value
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
        job = await job_repo.update_status(self.db, job_id, user_id, status)
        if not job:
            raise NotFoundError(
                message="Job not found",
                details={"job_id": str(job_id)},
            )
        return job

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
        ingestion_source: Literal["scrape", "email", "manual"],
        profile_id: UUID | None = None,
        resume_text: str | None = None,
        target_roles: list[str] | None = None,
        preferences: dict[str, Any] | None = None,
        min_score: float = 7.0,
        save_all: bool = False,
        search_terms: str | None = None,
    ) -> IngestionResult:
        """Ingest jobs from any source with optional AI analysis.

        This is the unified job ingestion method used by both the job search
        and email sync pipelines. It handles:
        1. Deduplication by job URL
        2. Optional AI analysis (if resume_text provided)
        3. Filtering by score (if analyzing)
        4. Saving to database

        Args:
            user_id: The user who owns these jobs
            jobs: List of RawJob objects to ingest
            ingestion_source: How jobs were discovered ('scrape', 'email', 'manual')
            profile_id: Optional profile ID to associate with jobs
            resume_text: If provided, AI analysis will be performed
            target_roles: Target roles for AI analysis context
            preferences: Additional preferences for AI analysis
            min_score: Minimum score to save (ignored if save_all=True)
            save_all: If True, save all jobs regardless of score
            search_terms: Search terms used to find these jobs

        Returns:
            IngestionResult with counts and optionally saved job objects
        """
        result = IngestionResult(jobs_received=len(jobs))

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

        # Step 2: Optionally analyze with AI
        analyzed_jobs: list[tuple[RawJob, dict | None]] = []

        if resume_text:
            # Import here to avoid circular imports
            from app.pipelines.actions.job_search.analyzer import (
                JobAnalysis,
                analyze_job,
            )
            from app.pipelines.actions.job_search.scraper import ScrapedJob

            for raw_job in new_jobs:
                # Convert RawJob to ScrapedJob for the analyzer
                scraped = ScrapedJob(
                    title=raw_job.title,
                    company=raw_job.company,
                    location=raw_job.location,
                    description=raw_job.description,
                    job_url=raw_job.job_url,
                    salary_range=raw_job.salary_range,
                    date_posted=raw_job.date_posted,
                    source=raw_job.source,
                )

                try:
                    analysis: JobAnalysis = await analyze_job(
                        scraped, resume_text, target_roles, preferences
                    )
                    analyzed_jobs.append(
                        (
                            raw_job,
                            {
                                "relevance_score": analysis.relevance_score,
                                "reasoning": analysis.reasoning,
                            },
                        )
                    )
                    result.jobs_analyzed += 1

                    if analysis.relevance_score >= min_score:
                        result.high_scoring += 1

                except Exception as e:
                    logger.warning(f"Failed to analyze job '{raw_job.title}': {e}")
                    analyzed_jobs.append((raw_job, None))
        else:
            # No analysis - just pass through
            analyzed_jobs = [(job, None) for job in new_jobs]

        # Step 3: Filter and save jobs
        jobs_to_save: list[dict] = []

        for raw_job, analysis in analyzed_jobs:
            # Decide whether to save based on score
            should_save = save_all or analysis is None
            if analysis and not save_all:
                should_save = analysis["relevance_score"] >= min_score

            if should_save:
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

                # Add analysis results if available
                if analysis:
                    job_data["relevance_score"] = analysis["relevance_score"]
                    job_data["reasoning"] = analysis["reasoning"]

                jobs_to_save.append(job_data)

        # Save to database
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
            Tuple of (pdf_bytes, filename)

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

        # Extract filename from path
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
