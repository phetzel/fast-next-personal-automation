"""Pipeline run repository for tracking execution history."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.pipeline_run import PipelineRun, PipelineRunStatus, PipelineTriggerType


def _utcnow() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


async def get_by_id(db: AsyncSession, run_id: UUID) -> PipelineRun | None:
    """Get a pipeline run by ID."""
    return await db.get(PipelineRun, run_id)


async def get_list(
    db: AsyncSession,
    *,
    pipeline_name: str | None = None,
    status: PipelineRunStatus | None = None,
    trigger_type: PipelineTriggerType | None = None,
    user_id: UUID | None = None,
    started_after: datetime | None = None,
    started_before: datetime | None = None,
    success_only: bool = False,
    error_only: bool = False,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[PipelineRun], int]:
    """Get list of pipeline runs with filtering and pagination.

    Args:
        db: Database session.
        pipeline_name: Filter by pipeline name.
        status: Filter by run status.
        trigger_type: Filter by trigger type.
        user_id: Filter by user ID.
        started_after: Filter runs started after this time.
        started_before: Filter runs started before this time.
        success_only: Only return successful runs.
        error_only: Only return failed runs.
        skip: Number of records to skip.
        limit: Maximum records to return.

    Returns:
        Tuple of (runs list, total count).
    """
    # Build filter conditions
    conditions = []

    if pipeline_name:
        conditions.append(PipelineRun.pipeline_name == pipeline_name)

    if status:
        conditions.append(PipelineRun.status == status.value)

    if trigger_type:
        conditions.append(PipelineRun.trigger_type == trigger_type.value)

    if user_id:
        conditions.append(PipelineRun.user_id == user_id)

    if started_after:
        conditions.append(PipelineRun.started_at >= started_after)

    if started_before:
        conditions.append(PipelineRun.started_at <= started_before)

    if success_only:
        conditions.append(PipelineRun.status == PipelineRunStatus.SUCCESS.value)

    if error_only:
        conditions.append(PipelineRun.status == PipelineRunStatus.ERROR.value)

    # Build base query
    query = select(PipelineRun)
    if conditions:
        query = query.where(and_(*conditions))

    # Order by most recent first
    query = query.order_by(PipelineRun.created_at.desc())

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total = await db.scalar(count_query) or 0

    # Apply pagination
    query = query.offset(skip).limit(limit)
    result = await db.execute(query)

    return list(result.scalars().all()), total


async def get_by_pipeline(
    db: AsyncSession,
    pipeline_name: str,
    *,
    skip: int = 0,
    limit: int = 20,
) -> tuple[list[PipelineRun], int]:
    """Get runs for a specific pipeline."""
    return await get_list(db, pipeline_name=pipeline_name, skip=skip, limit=limit)


async def create(
    db: AsyncSession,
    *,
    pipeline_name: str,
    trigger_type: PipelineTriggerType,
    user_id: UUID | None = None,
    input_data: dict | None = None,
    run_metadata: dict | None = None,
) -> PipelineRun:
    """Create a new pipeline run record.

    Initializes with PENDING status. Call start_run() to mark as running.
    """
    run = PipelineRun(
        pipeline_name=pipeline_name,
        trigger_type=trigger_type.value,
        status=PipelineRunStatus.PENDING.value,
        user_id=user_id,
        input_data=input_data,
        run_metadata=run_metadata,
    )
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def start_run(db: AsyncSession, run: PipelineRun) -> PipelineRun:
    """Mark a run as started (running)."""
    run.status = PipelineRunStatus.RUNNING.value
    run.started_at = _utcnow()
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def complete_run(
    db: AsyncSession,
    run: PipelineRun,
    *,
    output_data: dict | None = None,
    run_metadata: dict | None = None,
) -> PipelineRun:
    """Mark a run as successfully completed."""
    now = _utcnow()
    run.status = PipelineRunStatus.SUCCESS.value
    run.completed_at = now
    run.output_data = output_data

    if run.started_at:
        run.duration_ms = int((now - run.started_at).total_seconds() * 1000)

    if run_metadata:
        run.run_metadata = {**(run.run_metadata or {}), **run_metadata}

    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def fail_run(
    db: AsyncSession,
    run: PipelineRun,
    *,
    error_message: str,
    run_metadata: dict | None = None,
) -> PipelineRun:
    """Mark a run as failed."""
    now = _utcnow()
    run.status = PipelineRunStatus.ERROR.value
    run.completed_at = now
    run.error_message = error_message

    if run.started_at:
        run.duration_ms = int((now - run.started_at).total_seconds() * 1000)

    if run_metadata:
        run.run_metadata = {**(run.run_metadata or {}), **run_metadata}

    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def cancel_run(db: AsyncSession, run: PipelineRun) -> PipelineRun:
    """Mark a run as cancelled."""
    run.status = PipelineRunStatus.CANCELLED.value
    run.completed_at = _utcnow()
    db.add(run)
    await db.flush()
    await db.refresh(run)
    return run


async def get_stats(
    db: AsyncSession,
    *,
    pipeline_name: str | None = None,
    since: datetime | None = None,
) -> dict:
    """Get pipeline run statistics.

    Args:
        db: Database session.
        pipeline_name: Filter by pipeline name (optional).
        since: Only count runs since this time (optional).

    Returns:
        Dict with total, success, error, and average duration stats.
    """
    conditions = []
    if pipeline_name:
        conditions.append(PipelineRun.pipeline_name == pipeline_name)
    if since:
        conditions.append(PipelineRun.created_at >= since)

    base_query = select(PipelineRun)
    if conditions:
        base_query = base_query.where(and_(*conditions))

    # Total count
    total_query = select(func.count()).select_from(base_query.subquery())
    total = await db.scalar(total_query) or 0

    # Success count
    success_conditions = [*conditions, PipelineRun.status == PipelineRunStatus.SUCCESS.value]
    success_query = select(func.count()).select_from(
        select(PipelineRun).where(and_(*success_conditions)).subquery()
    )
    success = await db.scalar(success_query) or 0

    # Error count
    error_conditions = [*conditions, PipelineRun.status == PipelineRunStatus.ERROR.value]
    error_query = select(func.count()).select_from(
        select(PipelineRun).where(and_(*error_conditions)).subquery()
    )
    errors = await db.scalar(error_query) or 0

    # Average duration (only completed runs)
    duration_conditions = [
        *conditions,
        PipelineRun.duration_ms.isnot(None),
    ]
    avg_duration_query = select(func.avg(PipelineRun.duration_ms)).where(
        and_(*duration_conditions) if duration_conditions else True
    )
    avg_duration = await db.scalar(avg_duration_query)

    return {
        "total": total,
        "success": success,
        "errors": errors,
        "success_rate": round((success / total * 100) if total > 0 else 0, 1),
        "avg_duration_ms": round(avg_duration) if avg_duration else None,
    }


async def delete_old_runs(
    db: AsyncSession,
    *,
    older_than: datetime,
    keep_errors: bool = True,
) -> int:
    """Delete old pipeline runs for cleanup.

    Args:
        db: Database session.
        older_than: Delete runs older than this time.
        keep_errors: If True, don't delete error runs (for debugging).

    Returns:
        Number of deleted runs.
    """
    conditions = [PipelineRun.created_at < older_than]

    if keep_errors:
        conditions.append(PipelineRun.status != PipelineRunStatus.ERROR.value)

    query = select(PipelineRun).where(and_(*conditions))
    result = await db.execute(query)
    runs = list(result.scalars().all())

    for run in runs:
        await db.delete(run)

    await db.flush()
    return len(runs)
