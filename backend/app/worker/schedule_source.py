"""Database-backed schedule source for Taskiq.

Reads scheduled tasks from the PostgreSQL database to enable
dynamic pipeline scheduling via the frontend calendar UI.
"""

import logging
from datetime import UTC, datetime
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from taskiq.abc.schedule_source import ScheduleSource
from taskiq.scheduler.scheduled_task import ScheduledTask as TaskiqScheduledTask

logger = logging.getLogger(__name__)


# Task name for executing scheduled pipelines
SCHEDULED_PIPELINE_TASK = "app.worker.tasks.scheduled_pipeline:execute_scheduled_pipeline"


def _utcnow() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


def _as_utc(dt: datetime) -> datetime:
    """Normalize a datetime to timezone-aware UTC."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=UTC)
    return dt.astimezone(UTC)


def _calculate_next_run(
    cron_expression: str,
    *,
    timezone: str = "UTC",
    base_time: datetime | None = None,
) -> datetime:
    """Calculate next run timestamp in UTC from cron + timezone."""
    from croniter import croniter

    current_utc = _as_utc(base_time or _utcnow())
    try:
        tz = ZoneInfo(timezone)
    except ZoneInfoNotFoundError:
        logger.warning("Invalid timezone '%s' on schedule; defaulting to UTC.", timezone)
        tz = ZoneInfo("UTC")

    current_local = current_utc.astimezone(tz)
    cron = croniter(cron_expression, current_local)
    next_local = cron.get_next(datetime)
    if next_local.tzinfo is None:
        next_local = next_local.replace(tzinfo=tz)
    return next_local.astimezone(UTC)


class DatabaseScheduleSource(ScheduleSource):
    """Schedule source that reads from the database.

    Loads enabled scheduled tasks from the database and converts
    them to Taskiq ScheduledTask objects for the scheduler.

    This allows dynamic schedule management via the API/frontend
    without requiring code changes or deployments.
    """

    def __init__(self) -> None:
        self.schedules: dict[str, TaskiqScheduledTask] = {}

    async def startup(self) -> None:
        """Load schedules from database on startup."""
        await self._refresh_schedules()
        await super().startup()

    async def _refresh_schedules(self) -> None:
        """Reload all schedules from the database."""
        from app.db.session import get_db_context
        from app.repositories import scheduled_task_repo

        logger.info("Loading scheduled tasks from database")

        self.schedules.clear()

        try:
            async with get_db_context() as db:
                db_tasks = await scheduled_task_repo.get_all_enabled(db)

                for task in db_tasks:
                    schedule_id = str(task.id)

                    taskiq_task = TaskiqScheduledTask(
                        task_name=SCHEDULED_PIPELINE_TASK,
                        labels={
                            "scheduled_task_id": str(task.id),
                            "pipeline_name": task.pipeline_name,
                            "user_id": str(task.user_id),
                        },
                        args=[],
                        kwargs={
                            "scheduled_task_id": str(task.id),
                            "pipeline_name": task.pipeline_name,
                            "user_id": str(task.user_id),
                            "input_params": task.input_params or {},
                        },
                        schedule_id=schedule_id,
                        cron=task.cron_expression,
                        cron_offset=task.timezone if task.timezone != "UTC" else None,
                    )
                    self.schedules[schedule_id] = taskiq_task

                logger.info(f"Loaded {len(self.schedules)} scheduled tasks from database")

        except Exception as e:
            logger.exception(f"Failed to load schedules from database: {e}")

    async def get_schedules(self) -> list[TaskiqScheduledTask]:
        """Get all scheduled tasks.

        Taskiq scheduler asks sources for schedules on its regular
        update interval. Reload from the database on each call so
        schedule changes are picked up without restarts.
        """
        await self._refresh_schedules()
        return list(self.schedules.values())

    async def add_schedule(self, schedule: TaskiqScheduledTask) -> None:
        """Add a schedule dynamically.

        This is called when a new schedule is created via the API.
        The schedule is stored in the database by the API, and we
        just update our in-memory cache.
        """
        self.schedules[schedule.schedule_id] = schedule
        logger.info(f"Added schedule {schedule.schedule_id} to scheduler")

    async def delete_schedule(self, schedule_id: str) -> None:
        """Remove a schedule dynamically.

        Called when a schedule is deleted via the API.
        """
        if schedule_id in self.schedules:
            del self.schedules[schedule_id]
            logger.info(f"Removed schedule {schedule_id} from scheduler")

    async def post_send(self, task: TaskiqScheduledTask) -> None:
        """Update last run time after task execution.

        This is called after a scheduled task is sent to the broker.
        We update the database record with the execution time.
        """
        from uuid import UUID

        from app.db.session import get_db_context
        from app.repositories import scheduled_task_repo

        try:
            schedule_id = task.schedule_id
            task_uuid = UUID(schedule_id)

            async with get_db_context() as db:
                db_task = await scheduled_task_repo.get_by_id(db, task_uuid)
                if db_task:
                    now = _utcnow()
                    next_run = _calculate_next_run(
                        db_task.cron_expression,
                        timezone=db_task.timezone,
                        base_time=now,
                    )

                    await scheduled_task_repo.update_last_run(
                        db,
                        db_task,
                        last_run_at=now,
                        next_run_at=next_run,
                    )
                    await db.commit()

        except Exception as e:
            logger.exception(f"Failed to update last run time for schedule {task.schedule_id}: {e}")

    async def refresh(self) -> None:
        """Manually refresh schedules from database.

        Call this method to reload schedules without restarting
        the scheduler. Useful after bulk updates via the API.
        """
        await self._refresh_schedules()
