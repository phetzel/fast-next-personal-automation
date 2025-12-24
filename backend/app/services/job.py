"""Job service (PostgreSQL async).

Contains business logic for job operations. Uses job repository for database access.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.job import Job, JobStatus
from app.repositories import job_repo
from app.schemas.job import JobFilters, JobUpdate


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
