"""Job service (PostgreSQL async).

Contains business logic for job operations. Uses job repository for database access.
"""

import logging
from datetime import UTC, datetime
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
