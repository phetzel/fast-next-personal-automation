"""Tests for scheduled task service logic."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import ValidationError
from app.schemas.scheduled_task import ScheduledTaskCreate, ScheduledTaskUpdate
from app.services.scheduled_task import (
    ScheduledTaskService,
    _calculate_next_run,
    _get_occurrences_in_range,
)


class TestScheduledTaskTimezoneMath:
    """Tests for timezone-aware cron calculations."""

    def test_calculate_next_run_uses_schedule_timezone(self) -> None:
        """Next run should be computed in schedule timezone, then returned in UTC."""
        base_time = datetime(2026, 1, 15, 15, 0, tzinfo=UTC)  # 07:00 America/Los_Angeles
        next_run = _calculate_next_run(
            "0 9 * * *",
            base_time=base_time,
            timezone="America/Los_Angeles",
        )

        assert next_run == datetime(2026, 1, 15, 17, 0, tzinfo=UTC)

    def test_occurrence_generation_uses_schedule_timezone(self) -> None:
        """Occurrences should align with local schedule time across range."""
        start_date = datetime(2026, 1, 15, 0, 0, tzinfo=UTC)
        end_date = datetime(2026, 1, 16, 23, 59, tzinfo=UTC)

        occurrences = _get_occurrences_in_range(
            "0 9 * * *",
            start_date,
            end_date,
            timezone="America/New_York",
        )

        assert occurrences == [
            datetime(2026, 1, 15, 14, 0, tzinfo=UTC),
            datetime(2026, 1, 16, 14, 0, tzinfo=UTC),
        ]

    def test_invalid_timezone_raises_validation_error(self) -> None:
        """Invalid timezones should be rejected."""
        with pytest.raises(ValidationError):
            _calculate_next_run("0 9 * * *", timezone="Mars/Olympus_Mons")


class TestCalendarOccurrenceClamping:
    """Tests for occurrence generation respecting task creation date."""

    @pytest.mark.anyio
    async def test_occurrences_clamped_to_created_at(self) -> None:
        """Occurrences should not appear before the task was created."""
        db = AsyncMock()
        service = ScheduledTaskService(db)
        user_id = uuid4()

        task = SimpleNamespace(
            id=uuid4(),
            user_id=user_id,
            name="Daily prep",
            description=None,
            pipeline_name="job_prep",
            cron_expression="0 9 * * *",
            timezone="UTC",
            enabled=True,
            input_params=None,
            color="sky",
            next_run_at=datetime(2026, 1, 20, 9, 0, tzinfo=UTC),
            last_run_at=None,
            created_at=datetime(2026, 1, 18, 12, 0, tzinfo=UTC),
        )

        with patch.object(
            service.repo,
            "get_by_user_filtered",
            AsyncMock(return_value=([task], 1)),
        ):
            occurrences = await service.get_calendar_occurrences(
                user_id,
                datetime(2026, 1, 15, 0, 0, tzinfo=UTC),
                datetime(2026, 1, 21, 0, 0, tzinfo=UTC),
            )

        occurrence_dates = [o.start for o in occurrences]
        assert datetime(2026, 1, 15, 9, 0, tzinfo=UTC) not in occurrence_dates
        assert datetime(2026, 1, 16, 9, 0, tzinfo=UTC) not in occurrence_dates
        assert datetime(2026, 1, 17, 9, 0, tzinfo=UTC) not in occurrence_dates
        assert datetime(2026, 1, 19, 9, 0, tzinfo=UTC) in occurrence_dates
        assert datetime(2026, 1, 20, 9, 0, tzinfo=UTC) in occurrence_dates


class TestScheduledTaskServiceUpdates:
    """Tests for update semantics."""

    @pytest.mark.anyio
    async def test_create_task_disabled_sets_no_next_run(self) -> None:
        """Disabled schedules should not carry a next_run_at timestamp."""
        db = AsyncMock()
        service = ScheduledTaskService(db)
        user_id = uuid4()
        created_task = SimpleNamespace(id=uuid4())

        with (
            patch(
                "app.services.scheduled_task.get_pipeline_info",
                return_value=SimpleNamespace(name="job_prep"),
            ),
            patch.object(
                service.repo,
                "create_with_data",
                AsyncMock(return_value=created_task),
            ) as create_mock,
        ):
            payload = ScheduledTaskCreate(
                name="Disabled schedule",
                description=None,
                pipeline_name="job_prep",
                cron_expression="0 9 * * *",
                timezone="UTC",
                enabled=False,
                input_params=None,
                color="sky",
            )
            await service.create_task(user_id, payload)

        kwargs = create_mock.await_args.kwargs
        assert kwargs["enabled"] is False
        assert kwargs["next_run_at"] is None

    @pytest.mark.anyio
    async def test_update_task_allows_clearing_nullable_fields(self) -> None:
        """Explicit nulls in update payload should be persisted."""
        db = AsyncMock()
        service = ScheduledTaskService(db)
        task_id = uuid4()
        user_id = uuid4()

        task = SimpleNamespace(
            id=task_id,
            user_id=user_id,
            name="Daily prep",
            description="to be cleared",
            pipeline_name="job_prep",
            cron_expression="0 9 * * *",
            timezone="UTC",
            enabled=True,
            input_params={"foo": "bar"},
            color="sky",
            next_run_at=datetime(2026, 1, 15, 9, 0, tzinfo=UTC),
        )

        updated_task = SimpleNamespace(
            **{**task.__dict__, "description": None, "input_params": None, "color": None}
        )

        with (
            patch.object(service, "get_task", AsyncMock(return_value=task)),
            patch.object(
                service.repo,
                "update_fields",
                AsyncMock(return_value=updated_task),
            ) as update_mock,
        ):
            payload = ScheduledTaskUpdate(description=None, input_params=None, color=None)
            result = await service.update_task(task_id, user_id, payload)

        assert result.description is None
        assert result.input_params is None
        assert result.color is None

        kwargs = update_mock.await_args.kwargs
        assert "description" in kwargs and kwargs["description"] is None
        assert "input_params" in kwargs and kwargs["input_params"] is None
        assert "color" in kwargs and kwargs["color"] is None

    @pytest.mark.anyio
    async def test_update_task_disabling_clears_next_run(self) -> None:
        """Disabling via update should clear next_run_at consistently."""
        db = AsyncMock()
        service = ScheduledTaskService(db)
        task_id = uuid4()
        user_id = uuid4()

        task = SimpleNamespace(
            id=task_id,
            user_id=user_id,
            name="Daily prep",
            description=None,
            pipeline_name="job_prep",
            cron_expression="0 9 * * *",
            timezone="UTC",
            enabled=True,
            input_params=None,
            color="sky",
            next_run_at=datetime(2026, 1, 15, 9, 0, tzinfo=UTC),
        )

        updated_task = SimpleNamespace(**{**task.__dict__, "enabled": False, "next_run_at": None})

        with (
            patch.object(service, "get_task", AsyncMock(return_value=task)),
            patch.object(
                service.repo,
                "update_fields",
                AsyncMock(return_value=updated_task),
            ) as update_mock,
        ):
            payload = ScheduledTaskUpdate(enabled=False)
            result = await service.update_task(task_id, user_id, payload)

        assert result.enabled is False
        assert result.next_run_at is None
        kwargs = update_mock.await_args.kwargs
        assert kwargs["enabled"] is False
        assert kwargs["next_run_at"] is None

    @pytest.mark.anyio
    async def test_update_task_rejects_null_enabled(self) -> None:
        """enabled is non-nullable in storage and should reject explicit null."""
        db = AsyncMock()
        service = ScheduledTaskService(db)
        task_id = uuid4()
        user_id = uuid4()

        task = SimpleNamespace(
            id=task_id,
            user_id=user_id,
            name="Daily prep",
            description=None,
            pipeline_name="job_prep",
            cron_expression="0 9 * * *",
            timezone="UTC",
            enabled=True,
            input_params=None,
            color="sky",
            next_run_at=datetime(2026, 1, 15, 9, 0, tzinfo=UTC),
        )

        with (
            patch.object(service, "get_task", AsyncMock(return_value=task)),
            pytest.raises(ValidationError, match="enabled cannot be null"),
        ):
            await service.update_task(task_id, user_id, ScheduledTaskUpdate(enabled=None))
