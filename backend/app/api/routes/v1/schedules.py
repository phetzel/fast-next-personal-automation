"""Scheduled task API routes.

Provides REST endpoints for calendar-based pipeline scheduling:
- CRUD operations for scheduled tasks
- Calendar occurrences for date ranges
- Toggle enable/disable
"""

import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Query

from app.api.deps import CurrentUser, DBSession, ScheduledTaskSvc
from app.schemas.scheduled_task import (
    CalendarOccurrencesResponse,
    ScheduledTaskCreate,
    ScheduledTaskListResponse,
    ScheduledTaskResponse,
    ScheduledTaskUpdate,
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
