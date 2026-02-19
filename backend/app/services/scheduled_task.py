"""Scheduled task service for calendar-based pipeline scheduling."""

from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from croniter import croniter
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.db.models.scheduled_task import ScheduledTask
from app.pipelines.registry import get_pipeline_info
from app.repositories import scheduled_task_repo
from app.repositories.scheduled_task import ScheduledTaskRepository
from app.schemas.scheduled_task import CalendarOccurrence, ScheduledTaskCreate, ScheduledTaskUpdate
from app.services.base import BaseService


def _utcnow() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


def _as_utc(dt: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _resolve_timezone(timezone: str) -> ZoneInfo:
    """Resolve timezone name and raise ValidationError on invalid values."""
    try:
        return ZoneInfo(timezone)
    except ZoneInfoNotFoundError as exc:
        raise ValidationError(
            message=f"Invalid timezone: {timezone}",
            details={"timezone": timezone},
        ) from exc


def _validate_cron_expression(cron_expression: str) -> None:
    """Validate a cron expression."""
    try:
        croniter(cron_expression)
    except (ValueError, KeyError) as exc:
        raise ValidationError(
            message=f"Invalid cron expression: {cron_expression}",
            details={"cron_expression": cron_expression, "error": str(exc)},
        ) from exc


def _calculate_next_run(
    cron_expression: str,
    *,
    base_time: datetime | None = None,
    timezone: str = "UTC",
) -> datetime:
    """Calculate next run timestamp in UTC for a timezone-aware cron."""
    tz = _resolve_timezone(timezone)
    base_utc = _as_utc(base_time or _utcnow())
    base_local = base_utc.astimezone(tz)

    cron = croniter(cron_expression, base_local)
    next_time_local = cron.get_next(datetime)
    if next_time_local.tzinfo is None:
        next_time_local = next_time_local.replace(tzinfo=tz)

    return next_time_local.astimezone(UTC)


def _get_occurrences_in_range(
    cron_expression: str,
    start_date: datetime,
    end_date: datetime,
    *,
    timezone: str = "UTC",
) -> list[datetime]:
    """Get UTC occurrences in range for a timezone-aware cron schedule."""
    tz = _resolve_timezone(timezone)
    start_utc = _as_utc(start_date)
    end_utc = _as_utc(end_date)
    start_local = start_utc.astimezone(tz)
    end_local = end_utc.astimezone(tz)

    occurrences: list[datetime] = []
    cron = croniter(cron_expression, start_local - timedelta(seconds=1))

    while True:
        next_time_local = cron.get_next(datetime)
        if next_time_local.tzinfo is None:
            next_time_local = next_time_local.replace(tzinfo=tz)

        if next_time_local > end_local:
            break

        if next_time_local >= start_local:
            occurrences.append(next_time_local.astimezone(UTC))

        if len(occurrences) > 1000:
            break

    return occurrences


class ScheduledTaskService(BaseService[ScheduledTask, ScheduledTaskRepository]):
    """Service for scheduled-task business logic."""

    entity_name = "ScheduledTask"

    def __init__(self, db: AsyncSession):
        super().__init__(db, scheduled_task_repo._repository)

    async def get_task(self, task_id: UUID, user_id: UUID) -> ScheduledTask:
        """Get a scheduled task ensuring ownership."""
        task = await self.repo.get_by_id_and_user(self.db, task_id, user_id)
        if not task:
            raise NotFoundError(
                message="Scheduled task not found",
                details={"task_id": str(task_id)},
            )
        return task

    async def list_tasks(
        self,
        user_id: UUID,
        *,
        enabled_only: bool = False,
        pipeline_name: str | None = None,
        page: int = 1,
        page_size: int = 50,
    ) -> tuple[list[ScheduledTask], int]:
        """List scheduled tasks for a user."""
        skip = (page - 1) * page_size
        return await self.repo.get_by_user_filtered(
            self.db,
            user_id,
            enabled_only=enabled_only,
            pipeline_name=pipeline_name,
            skip=skip,
            limit=page_size,
        )

    async def create_task(self, user_id: UUID, task_data: ScheduledTaskCreate) -> ScheduledTask:
        """Create a new scheduled task."""
        _validate_cron_expression(task_data.cron_expression)

        pipeline_info = get_pipeline_info(task_data.pipeline_name)
        if not pipeline_info:
            raise ValidationError(
                message=f"Pipeline not found: {task_data.pipeline_name}",
                details={"pipeline_name": task_data.pipeline_name},
            )

        next_run_at: datetime | None = None
        if task_data.enabled:
            next_run_at = _calculate_next_run(
                task_data.cron_expression,
                timezone=task_data.timezone,
            )

        return await self.repo.create_with_data(
            self.db,
            name=task_data.name,
            description=task_data.description,
            pipeline_name=task_data.pipeline_name,
            cron_expression=task_data.cron_expression,
            timezone=task_data.timezone,
            enabled=task_data.enabled,
            user_id=user_id,
            input_params=task_data.input_params,
            next_run_at=next_run_at,
            color=task_data.color,
        )

    async def update_task(
        self,
        task_id: UUID,
        user_id: UUID,
        task_data: ScheduledTaskUpdate,
    ) -> ScheduledTask:
        """Update an existing scheduled task."""
        task = await self.get_task(task_id, user_id)
        update_data = task_data.model_dump(exclude_unset=True)

        if "cron_expression" in update_data:
            cron_expression = update_data["cron_expression"]
            if cron_expression is None:
                raise ValidationError(
                    message="cron_expression cannot be null",
                    details={"cron_expression": cron_expression},
                )
            _validate_cron_expression(cron_expression)

        if "pipeline_name" in update_data:
            pipeline_name = update_data["pipeline_name"]
            if pipeline_name is None:
                raise ValidationError(
                    message="pipeline_name cannot be null",
                    details={"pipeline_name": pipeline_name},
                )
            pipeline_info = get_pipeline_info(pipeline_name)
            if not pipeline_info:
                raise ValidationError(
                    message=f"Pipeline not found: {pipeline_name}",
                    details={"pipeline_name": pipeline_name},
                )

        if "timezone" in update_data:
            timezone = update_data["timezone"]
            if timezone is None:
                raise ValidationError(
                    message="timezone cannot be null",
                    details={"timezone": timezone},
                )
            _resolve_timezone(timezone)

        if "enabled" in update_data and update_data["enabled"] is None:
            raise ValidationError(
                message="enabled cannot be null",
                details={"enabled": update_data["enabled"]},
            )

        target_enabled = update_data.get("enabled", task.enabled)
        cron_changed = "cron_expression" in update_data
        timezone_changed = "timezone" in update_data
        enabling_task = update_data.get("enabled") is True and not task.enabled
        if target_enabled is False:
            update_data["next_run_at"] = None
        elif cron_changed or timezone_changed or enabling_task:
            new_cron = update_data.get("cron_expression", task.cron_expression)
            new_timezone = update_data.get("timezone", task.timezone)
            update_data["next_run_at"] = _calculate_next_run(new_cron, timezone=new_timezone)

        return await self.repo.update_fields(self.db, task, **update_data)

    async def delete_task(self, task_id: UUID, user_id: UUID) -> bool:
        """Delete a scheduled task."""
        await self.get_task(task_id, user_id)
        return await self.repo.delete_by_id(self.db, task_id)

    async def toggle_enabled(
        self,
        task_id: UUID,
        user_id: UUID,
        enabled: bool,
    ) -> ScheduledTask:
        """Enable or disable a scheduled task."""
        task = await self.get_task(task_id, user_id)

        if enabled and not task.enabled:
            next_run_at = _calculate_next_run(task.cron_expression, timezone=task.timezone)
            return await self.repo.update_fields(
                self.db,
                task,
                enabled=True,
                next_run_at=next_run_at,
            )

        updates: dict[str, Any] = {"enabled": enabled}
        if not enabled:
            updates["next_run_at"] = None
        return await self.repo.update_fields(self.db, task, **updates)

    async def get_calendar_occurrences(
        self,
        user_id: UUID,
        start_date: datetime,
        end_date: datetime,
        *,
        pipeline_name: str | None = None,
        enabled_only: bool = True,
    ) -> list[CalendarOccurrence]:
        """Compute schedule occurrences for a date range."""
        start_utc = _as_utc(start_date)
        end_utc = _as_utc(end_date)
        if end_utc < start_utc:
            raise ValidationError(
                message="end_date must be greater than or equal to start_date",
                details={
                    "start_date": start_utc.isoformat(),
                    "end_date": end_utc.isoformat(),
                },
            )

        tasks, _ = await self.repo.get_by_user_filtered(
            self.db,
            user_id,
            enabled_only=enabled_only,
            pipeline_name=pipeline_name,
            skip=0,
            limit=1000,
        )

        occurrences: list[CalendarOccurrence] = []
        for task in tasks:
            # Clamp start to task creation time so we don't generate
            # phantom occurrences for dates before the schedule existed.
            effective_start = max(start_utc, _as_utc(task.created_at))
            if effective_start >= end_utc:
                continue

            task_occurrences = _get_occurrences_in_range(
                task.cron_expression,
                effective_start,
                end_utc,
                timezone=task.timezone,
            )
            for occurrence_time in task_occurrences:
                occurrences.append(
                    CalendarOccurrence(
                        id=f"{task.id}_{occurrence_time.isoformat()}",
                        task_id=task.id,
                        title=task.name,
                        description=task.description,
                        pipeline_name=task.pipeline_name,
                        start=occurrence_time,
                        end=occurrence_time + timedelta(hours=1),
                        all_day=False,
                        color=task.color,
                        cron_expression=task.cron_expression,
                        enabled=task.enabled,
                    )
                )

        occurrences.sort(key=lambda item: item.start)
        return occurrences

    async def mark_task_executed(self, task: ScheduledTask) -> ScheduledTask:
        """Mark a task as executed and recalculate next run."""
        now = _utcnow()
        next_run_at = _calculate_next_run(
            task.cron_expression,
            base_time=now,
            timezone=task.timezone,
        )
        return await self.repo.update_last_run(
            self.db,
            task,
            last_run_at=now,
            next_run_at=next_run_at,
        )
