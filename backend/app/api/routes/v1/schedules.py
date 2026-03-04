"""Scheduled task API routes.

Provides REST endpoints for calendar-based pipeline scheduling:
- CRUD operations for scheduled tasks
- Calendar occurrences for date ranges (future, computed from cron)
- Past pipeline runs as calendar events (actual history)
- System tasks visibility (hardcoded crons)
- Toggle enable/disable
"""

import logging
from datetime import UTC, datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import CurrentUser, DBSession, ScheduledTaskSvc
from app.db.models.pipeline_run import PipelineRun, PipelineRunStatus
from app.db.models.scheduled_task import ScheduledTask
from app.schemas.scheduled_task import (
    CalendarOccurrencesResponse,
    CalendarRunEvent,
    CalendarRunsResponse,
    ScheduledTaskCreate,
    ScheduledTaskListResponse,
    ScheduledTaskResponse,
    ScheduledTaskUpdate,
    SystemTask,
    SystemTasksResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=ScheduledTaskListResponse)
async def list_scheduled_tasks(
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
    enabled_only: bool = Query(False, description="Only return enabled tasks"),
    pipeline_name: str | None = Query(None, description="Filter by pipeline name"),
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(50, ge=1, le=100, description="Items per page"),
) -> ScheduledTaskListResponse:
    """List all scheduled tasks for the current user.

    Returns tasks with pagination, optionally filtered by enabled status
    or pipeline name.
    """
    tasks, total = await schedule_service.list_tasks(
        current_user.id,
        enabled_only=enabled_only,
        pipeline_name=pipeline_name,
        page=page,
        page_size=page_size,
    )

    return ScheduledTaskListResponse(
        tasks=[ScheduledTaskResponse.model_validate(task) for task in tasks],
        total=total,
        page=page,
        page_size=page_size,
        has_more=(page * page_size) < total,
    )


@router.get("/occurrences", response_model=CalendarOccurrencesResponse)
async def get_calendar_occurrences(
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
    start_date: datetime = Query(..., description="Start of date range"),
    end_date: datetime = Query(..., description="End of date range"),
    pipeline_name: str | None = Query(None, description="Filter by pipeline name"),
    enabled_only: bool = Query(True, description="Only include enabled schedules"),
) -> CalendarOccurrencesResponse:
    """Get calendar occurrences for a date range.

    Computes all scheduled occurrences based on cron expressions
    for display in the calendar UI. Each occurrence represents
    a single scheduled run of a pipeline.
    """
    occurrences = await schedule_service.get_calendar_occurrences(
        current_user.id,
        start_date,
        end_date,
        pipeline_name=pipeline_name,
        enabled_only=enabled_only,
    )

    return CalendarOccurrencesResponse(
        occurrences=occurrences,
        start_date=start_date,
        end_date=end_date,
    )


@router.get("/runs-calendar", response_model=CalendarRunsResponse)
async def get_runs_calendar(
    current_user: CurrentUser,
    db: DBSession,
    start_date: datetime = Query(..., description="Start of date range (inclusive)"),
    end_date: datetime = Query(..., description="End of date range (inclusive)"),
) -> CalendarRunsResponse:
    """Get past pipeline runs as calendar events for a date range.

    Returns actual run records (not computed occurrences) so the calendar
    can show past = real history, future = scheduled occurrences.

    Each event includes the linked scheduled task's color (if run was triggered
    by a cron task and that task still exists), or null for orphaned/API runs.
    """
    # Fetch pipeline runs in range for this user
    result = await db.execute(
        select(PipelineRun)
        .where(
            PipelineRun.user_id == current_user.id,
            PipelineRun.started_at >= start_date,
            PipelineRun.started_at <= end_date,
        )
        .order_by(PipelineRun.started_at.desc())
        .limit(500)
    )
    runs = result.scalars().all()

    # Build a map of scheduled_task_id → color for quick lookup
    task_color_map: dict[str, str | None] = {}
    raw_task_ids = {
        run.run_metadata.get("scheduled_task_id")
        for run in runs
        if run.run_metadata and run.run_metadata.get("scheduled_task_id")
    }
    valid_task_ids: set[UUID] = set()
    for tid in raw_task_ids:
        try:
            valid_task_ids.add(UUID(str(tid)))
        except (ValueError, TypeError):
            logger.warning("Ignoring invalid scheduled_task_id in run metadata: %r", tid)
    if valid_task_ids:
        tasks_result = await db.execute(
            select(ScheduledTask).where(ScheduledTask.id.in_(list(valid_task_ids)))
        )
        for task in tasks_result.scalars().all():
            task_color_map[str(task.id)] = task.color

    # Status → color mapping for runs not tied to a task
    status_color_map = {
        PipelineRunStatus.SUCCESS.value: "emerald",
        PipelineRunStatus.ERROR.value: "rose",
        PipelineRunStatus.RUNNING.value: "sky",
        PipelineRunStatus.PENDING.value: "sky",
        PipelineRunStatus.CANCELLED.value: "amber",
    }

    # Status → title suffix
    status_suffix = {
        PipelineRunStatus.SUCCESS.value: "✓",
        PipelineRunStatus.ERROR.value: "✗",
        PipelineRunStatus.RUNNING.value: "…",
        PipelineRunStatus.PENDING.value: "…",
        PipelineRunStatus.CANCELLED.value: "—",
    }

    events: list[CalendarRunEvent] = []
    for run in runs:
        scheduled_task_id = run.run_metadata.get("scheduled_task_id") if run.run_metadata else None

        # Prefer the linked task's color; fall back to status color; then null
        if scheduled_task_id and scheduled_task_id in task_color_map:
            color = task_color_map[scheduled_task_id]
        elif scheduled_task_id:
            # Task was deleted — show as muted (no color)
            color = None
        else:
            color = status_color_map.get(run.status)

        start = run.started_at or run.created_at
        if run.completed_at:
            end = run.completed_at
        elif run.duration_ms:
            end = start + timedelta(milliseconds=run.duration_ms)
        else:
            end = start + timedelta(minutes=5)

        suffix = status_suffix.get(run.status, "")
        title = f"{run.pipeline_name} {suffix}".strip()

        events.append(
            CalendarRunEvent(
                id=f"run_{run.id}",
                run_id=str(run.id),
                title=title,
                pipeline_name=run.pipeline_name,
                start=start,
                end=end,
                all_day=False,
                color=color,
                status=run.status,
                trigger_type=run.trigger_type,
                scheduled_task_id=scheduled_task_id,
                duration_ms=run.duration_ms,
            )
        )

    return CalendarRunsResponse(events=events, start_date=start_date, end_date=end_date)


@router.get("/system-tasks", response_model=SystemTasksResponse)
async def get_system_tasks(current_user: CurrentUser) -> SystemTasksResponse:
    """Get hardcoded system cron tasks.

    These tasks run automatically and cannot be edited or deleted by users.
    They are shown in the Schedules page for visibility.
    """
    from croniter import croniter

    now = datetime.now(UTC)

    system_task_definitions = [
        {
            "id": "system_recurring_expenses",
            "name": "Process Recurring Expenses",
            "description": (
                "Automatically creates debit transactions for recurring expenses that are "
                "due today, deducts from linked account balances, and advances billing cycles."
            ),
            "cron_expression": "0 0 * * *",
            "timezone": "UTC",
        },
    ]

    tasks: list[SystemTask] = []
    for defn in system_task_definitions:
        cron = croniter(defn["cron_expression"], now)
        next_run = cron.get_next(datetime).replace(tzinfo=UTC)
        tasks.append(
            SystemTask(
                id=defn["id"],
                name=defn["name"],
                description=defn["description"],
                cron_expression=defn["cron_expression"],
                timezone=defn["timezone"],
                next_run_at=next_run,
                last_run_at=None,
            )
        )

    return SystemTasksResponse(tasks=tasks)


@router.post("", response_model=ScheduledTaskResponse, status_code=201)
async def create_scheduled_task(
    task_data: ScheduledTaskCreate,
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
    db: DBSession,
) -> ScheduledTaskResponse:
    """Create a new scheduled task.

    The cron expression is validated and the next run time is calculated
    automatically. The pipeline must exist for creation to succeed.
    """
    logger.info(
        f"Creating scheduled task '{task_data.name}' for user {current_user.id}",
        extra={
            "user_id": str(current_user.id),
            "pipeline_name": task_data.pipeline_name,
            "cron_expression": task_data.cron_expression,
        },
    )

    task = await schedule_service.create_task(current_user.id, task_data)
    await db.commit()

    return ScheduledTaskResponse.model_validate(task)


@router.get("/{task_id}", response_model=ScheduledTaskResponse)
async def get_scheduled_task(
    task_id: UUID,
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
) -> ScheduledTaskResponse:
    """Get a specific scheduled task by ID."""
    task = await schedule_service.get_task(task_id, current_user.id)
    return ScheduledTaskResponse.model_validate(task)


@router.put("/{task_id}", response_model=ScheduledTaskResponse)
async def update_scheduled_task(
    task_id: UUID,
    task_data: ScheduledTaskUpdate,
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
    db: DBSession,
) -> ScheduledTaskResponse:
    """Update a scheduled task.

    If the cron expression or timezone is changed, the next run time
    is recalculated automatically.
    """
    logger.info(
        f"Updating scheduled task {task_id} for user {current_user.id}",
        extra={"task_id": str(task_id), "user_id": str(current_user.id)},
    )

    task = await schedule_service.update_task(task_id, current_user.id, task_data)
    await db.commit()

    return ScheduledTaskResponse.model_validate(task)


@router.delete("/{task_id}", status_code=204)
async def delete_scheduled_task(
    task_id: UUID,
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
    db: DBSession,
) -> None:
    """Delete a scheduled task.

    This permanently removes the task and all associated history.
    """
    logger.info(
        f"Deleting scheduled task {task_id} for user {current_user.id}",
        extra={"task_id": str(task_id), "user_id": str(current_user.id)},
    )

    await schedule_service.delete_task(task_id, current_user.id)
    await db.commit()


@router.post("/{task_id}/toggle", response_model=ScheduledTaskResponse)
async def toggle_scheduled_task(
    task_id: UUID,
    current_user: CurrentUser,
    schedule_service: ScheduledTaskSvc,
    db: DBSession,
    enabled: bool | None = Query(None, description="New enabled state; omit to invert"),
) -> ScheduledTaskResponse:
    """Enable or disable a scheduled task.

    When enabling a task, the next run time is recalculated
    from the current time.
    """
    if enabled is None:
        task = await schedule_service.get_task(task_id, current_user.id)
        enabled = not task.enabled

    logger.info(
        f"{'Enabling' if enabled else 'Disabling'} scheduled task {task_id}",
        extra={"task_id": str(task_id), "user_id": str(current_user.id), "enabled": enabled},
    )

    task = await schedule_service.toggle_enabled(task_id, current_user.id, enabled)
    await db.commit()

    return ScheduledTaskResponse.model_validate(task)
