"""Job service (PostgreSQL async).

Contains business logic for job operations. Uses job repository for database access.
"""

import logging
from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.cover_letter_pdf import (
    generate_cover_letter_filename,
    generate_cover_letter_pdf,
)
from app.core.exceptions import NotFoundError, ValidationError
from app.core.storage import get_storage_instance
from app.db.models.job import Job, JobStatus
from app.db.models.user import User
from app.repositories import job_repo
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
    ) -> Job:
        """Generate a PDF from the job's cover letter and store it in S3.

        This should be called after the user has reviewed/edited the cover letter.
        The PDF will be stored with a professional filename for easy uploading
        to job application portals.

        Args:
            job_id: The job ID
            user: The authenticated user (for name/email in the letter)

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

        # Generate the PDF
        applicant_name = user.full_name or user.email.split("@")[0]
        pdf_bytes = generate_cover_letter_pdf(
            cover_letter_text=job.cover_letter,
            applicant_name=applicant_name,
            applicant_email=user.email,
            company_name=job.company,
            job_title=job.title,
        )

        # Generate professional filename
        filename = generate_cover_letter_filename(
            company=job.company,
            job_title=job.title,
            applicant_name=applicant_name,
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
