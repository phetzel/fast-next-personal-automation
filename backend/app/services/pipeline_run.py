"""Pipeline run service for tracking and persisting executions.

Provides a service layer for pipeline run tracking, including:
- Creating and updating run records
- Filtering and querying run history
- Statistics and metrics
"""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID


def _utcnow() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.pipeline_run import PipelineRun, PipelineRunStatus, PipelineTriggerType
from app.pipelines.action_base import PipelineSource
from app.repositories import pipeline_run_repo

# Map PipelineSource to PipelineTriggerType
SOURCE_TO_TRIGGER: dict[PipelineSource, PipelineTriggerType] = {
    PipelineSource.API: PipelineTriggerType.API,
    PipelineSource.WEBHOOK: PipelineTriggerType.WEBHOOK,
    PipelineSource.AGENT: PipelineTriggerType.AGENT,
    PipelineSource.CRON: PipelineTriggerType.CRON,
    PipelineSource.MANUAL: PipelineTriggerType.MANUAL,
}


class PipelineRunService:
    """Service for pipeline run tracking and history."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_run(self, run_id: UUID) -> PipelineRun:
        """Get a pipeline run by ID.

        Raises:
            NotFoundError: If run does not exist.
        """
        run = await pipeline_run_repo.get_by_id(self.db, run_id)
        if not run:
            raise NotFoundError(
                message="Pipeline run not found",
                details={"run_id": str(run_id)},
            )
        return run

    async def list_runs(
        self,
        *,
        pipeline_name: str | None = None,
        status: PipelineRunStatus | None = None,
        trigger_type: PipelineTriggerType | None = None,
        user_id: UUID | None = None,
        started_after: datetime | None = None,
        started_before: datetime | None = None,
        success_only: bool = False,
        error_only: bool = False,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PipelineRun], int]:
        """List pipeline runs with filtering and pagination.

        Args:
            pipeline_name: Filter by pipeline name.
            status: Filter by run status.
            trigger_type: Filter by trigger type.
            user_id: Filter by user ID.
            started_after: Filter runs started after this time.
            started_before: Filter runs started before this time.
            success_only: Only return successful runs.
            error_only: Only return failed runs.
            page: Page number (1-indexed).
            page_size: Number of items per page.

        Returns:
            Tuple of (runs list, total count).
        """
        skip = (page - 1) * page_size
        return await pipeline_run_repo.get_list(
            self.db,
            pipeline_name=pipeline_name,
            status=status,
            trigger_type=trigger_type,
            user_id=user_id,
            started_after=started_after,
            started_before=started_before,
            success_only=success_only,
            error_only=error_only,
            skip=skip,
            limit=page_size,
        )

    async def get_runs_for_pipeline(
        self,
        pipeline_name: str,
        *,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[PipelineRun], int]:
        """Get all runs for a specific pipeline."""
        skip = (page - 1) * page_size
        return await pipeline_run_repo.get_by_pipeline(
            self.db,
            pipeline_name,
            skip=skip,
            limit=page_size,
        )

    async def create_run(
        self,
        *,
        pipeline_name: str,
        source: PipelineSource,
        user_id: UUID | None = None,
        input_data: dict[str, Any] | None = None,
        run_metadata: dict[str, Any] | None = None,
    ) -> PipelineRun:
        """Create a new pipeline run record.

        Creates the run in PENDING status. Call start_run() when execution begins.
        """
        trigger_type = SOURCE_TO_TRIGGER.get(source, PipelineTriggerType.API)
        return await pipeline_run_repo.create(
            self.db,
            pipeline_name=pipeline_name,
            trigger_type=trigger_type,
            user_id=user_id,
            input_data=input_data,
            run_metadata=run_metadata,
        )

    async def start_run(self, run: PipelineRun) -> PipelineRun:
        """Mark a run as started (running)."""
        return await pipeline_run_repo.start_run(self.db, run)

    async def complete_run(
        self,
        run: PipelineRun,
        *,
        output_data: dict[str, Any] | None = None,
        run_metadata: dict[str, Any] | None = None,
    ) -> PipelineRun:
        """Mark a run as successfully completed."""
        return await pipeline_run_repo.complete_run(
            self.db,
            run,
            output_data=output_data,
            run_metadata=run_metadata,
        )

    async def fail_run(
        self,
        run: PipelineRun,
        *,
        error_message: str,
        run_metadata: dict[str, Any] | None = None,
    ) -> PipelineRun:
        """Mark a run as failed."""
        return await pipeline_run_repo.fail_run(
            self.db,
            run,
            error_message=error_message,
            run_metadata=run_metadata,
        )

    async def cancel_run(self, run: PipelineRun) -> PipelineRun:
        """Mark a run as cancelled."""
        return await pipeline_run_repo.cancel_run(self.db, run)

    async def get_stats(
        self,
        *,
        pipeline_name: str | None = None,
        since_hours: int | None = 24,
    ) -> dict:
        """Get pipeline run statistics.

        Args:
            pipeline_name: Filter by pipeline name (optional).
            since_hours: Only count runs in the last N hours (default: 24).

        Returns:
            Dict with total, success, error, and average duration stats.
        """
        since = None
        if since_hours:
            since = _utcnow() - timedelta(hours=since_hours)

        return await pipeline_run_repo.get_stats(
            self.db,
            pipeline_name=pipeline_name,
            since=since,
        )

    async def cleanup_old_runs(
        self,
        *,
        days_to_keep: int = 30,
        keep_errors: bool = True,
    ) -> int:
        """Delete old pipeline runs.

        Args:
            days_to_keep: Delete runs older than this many days.
            keep_errors: If True, don't delete error runs (for debugging).

        Returns:
            Number of deleted runs.
        """
        older_than = _utcnow() - timedelta(days=days_to_keep)
        return await pipeline_run_repo.delete_old_runs(
            self.db,
            older_than=older_than,
            keep_errors=keep_errors,
        )

