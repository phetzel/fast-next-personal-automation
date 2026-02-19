"""Scheduled task repository for calendar-based pipeline scheduling."""

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.scheduled_task import ScheduledTask
from app.repositories.base import UserOwnedRepository
from app.schemas.scheduled_task import ScheduledTaskCreate, ScheduledTaskUpdate


def _utcnow() -> datetime:
    """Return current UTC time as timezone-aware datetime."""
    return datetime.now(UTC)


class ScheduledTaskRepository(
    UserOwnedRepository[ScheduledTask, ScheduledTaskCreate, ScheduledTaskUpdate]
):
    """Repository for ScheduledTask operations."""

    def __init__(self) -> None:
        super().__init__(ScheduledTask)

    async def get_by_user_filtered(
        self,
        db: AsyncSession,
        user_id: UUID,
        *,
        enabled_only: bool = False,
        pipeline_name: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[ScheduledTask], int]:
        """Get scheduled tasks for a user with filtering and pagination."""
        conditions = [self.model.user_id == user_id]
        if enabled_only:
            conditions.append(self.model.enabled.is_(True))
        if pipeline_name:
            conditions.append(self.model.pipeline_name == pipeline_name)

        query = (
            select(self.model)
            .where(and_(*conditions))
            .order_by(
                self.model.next_run_at.asc().nullslast(),
                self.model.created_at.desc(),
            )
        )

        count_query = select(func.count()).select_from(query.subquery())
        total = await db.scalar(count_query) or 0

        result = await db.execute(query.offset(skip).limit(limit))
        return list(result.scalars().all()), total

    async def get_all_enabled(self, db: AsyncSession) -> list[ScheduledTask]:
        """Get all enabled scheduled tasks."""
        result = await db.execute(
            select(self.model)
            .where(self.model.enabled.is_(True))
            .order_by(self.model.next_run_at.asc().nullslast())
        )
        return list(result.scalars().all())

    async def get_due_tasks(
        self,
        db: AsyncSession,
        *,
        before: datetime | None = None,
    ) -> list[ScheduledTask]:
        """Get enabled tasks that are due to run."""
        due_before = before or _utcnow()
        result = await db.execute(
            select(self.model).where(
                self.model.enabled.is_(True),
                self.model.next_run_at <= due_before,
            )
        )
        return list(result.scalars().all())

    async def create_with_data(
        self,
        db: AsyncSession,
        *,
        name: str,
        pipeline_name: str,
        cron_expression: str,
        user_id: UUID,
        description: str | None = None,
        timezone: str = "UTC",
        enabled: bool = True,
        input_params: dict | None = None,
        next_run_at: datetime | None = None,
        color: str | None = None,
    ) -> ScheduledTask:
        """Create a scheduled task from explicit fields."""
        return await self.create_with_kwargs(
            db,
            name=name,
            description=description,
            pipeline_name=pipeline_name,
            cron_expression=cron_expression,
            timezone=timezone,
            enabled=enabled,
            user_id=user_id,
            input_params=input_params,
            next_run_at=next_run_at,
            color=color,
        )

    async def update_fields(
        self,
        db: AsyncSession,
        task: ScheduledTask,
        **update_data,
    ) -> ScheduledTask:
        """Update a task with explicit field map."""
        return await super().update(db, db_obj=task, obj_in=update_data)

    async def update_last_run(
        self,
        db: AsyncSession,
        task: ScheduledTask,
        *,
        last_run_at: datetime,
        next_run_at: datetime | None,
    ) -> ScheduledTask:
        """Update last and next run timestamps."""
        return await self.update_fields(
            db,
            task,
            last_run_at=last_run_at,
            next_run_at=next_run_at,
        )

    async def delete_by_id(self, db: AsyncSession, task_id: UUID) -> bool:
        """Delete by id and return whether deletion occurred."""
        deleted = await super().delete(db, id=task_id)
        return deleted is not None

    async def toggle_enabled(
        self,
        db: AsyncSession,
        task: ScheduledTask,
        enabled: bool,
    ) -> ScheduledTask:
        """Enable or disable a task."""
        return await self.update_fields(db, task, enabled=enabled)


# Module-level singleton for compatibility
_repository = ScheduledTaskRepository()


async def get_by_id(db: AsyncSession, task_id: UUID) -> ScheduledTask | None:
    """Get a scheduled task by ID."""
    return await _repository.get(db, task_id)


async def get_by_id_and_user(
    db: AsyncSession, task_id: UUID, user_id: UUID
) -> ScheduledTask | None:
    """Get a scheduled task by ID ensuring ownership."""
    return await _repository.get_by_id_and_user(db, task_id, user_id)


async def get_by_user(
    db: AsyncSession,
    user_id: UUID,
    *,
    enabled_only: bool = False,
    pipeline_name: str | None = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[list[ScheduledTask], int]:
    """Get scheduled tasks for a user with filtering and pagination."""
    return await _repository.get_by_user_filtered(
        db,
        user_id,
        enabled_only=enabled_only,
        pipeline_name=pipeline_name,
        skip=skip,
        limit=limit,
    )


async def get_all_enabled(db: AsyncSession) -> list[ScheduledTask]:
    """Get all enabled scheduled tasks."""
    return await _repository.get_all_enabled(db)


async def get_due_tasks(
    db: AsyncSession,
    *,
    before: datetime | None = None,
) -> list[ScheduledTask]:
    """Get enabled tasks that are due to run."""
    return await _repository.get_due_tasks(db, before=before)


async def create(
    db: AsyncSession,
    *,
    name: str,
    pipeline_name: str,
    cron_expression: str,
    user_id: UUID,
    description: str | None = None,
    timezone: str = "UTC",
    enabled: bool = True,
    input_params: dict | None = None,
    next_run_at: datetime | None = None,
    color: str | None = None,
) -> ScheduledTask:
    """Create a new scheduled task."""
    return await _repository.create_with_data(
        db,
        name=name,
        description=description,
        pipeline_name=pipeline_name,
        cron_expression=cron_expression,
        timezone=timezone,
        enabled=enabled,
        user_id=user_id,
        input_params=input_params,
        next_run_at=next_run_at,
        color=color,
    )


async def update(
    db: AsyncSession,
    task: ScheduledTask,
    **kwargs,
) -> ScheduledTask:
    """Update a scheduled task."""
    return await _repository.update_fields(db, task, **kwargs)


async def update_last_run(
    db: AsyncSession,
    task: ScheduledTask,
    *,
    last_run_at: datetime,
    next_run_at: datetime | None,
) -> ScheduledTask:
    """Update the last run time and next run time."""
    return await _repository.update_last_run(
        db,
        task,
        last_run_at=last_run_at,
        next_run_at=next_run_at,
    )


async def delete(db: AsyncSession, task_id: UUID) -> bool:
    """Delete a scheduled task by ID."""
    return await _repository.delete_by_id(db, task_id)


async def toggle_enabled(
    db: AsyncSession,
    task: ScheduledTask,
    enabled: bool,
) -> ScheduledTask:
    """Enable or disable a scheduled task."""
    return await _repository.toggle_enabled(db, task, enabled)
