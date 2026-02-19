"""Tests for schedules API route handlers."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.routes.v1.schedules import toggle_scheduled_task


def _build_task(*, enabled: bool) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        user_id=uuid4(),
        name="Task",
        description=None,
        pipeline_name="job_prep",
        cron_expression="0 9 * * *",
        timezone="UTC",
        enabled=enabled,
        input_params=None,
        color="sky",
        next_run_at=now,
        last_run_at=None,
        created_at=now,
        updated_at=None,
    )


@pytest.mark.anyio
async def test_toggle_without_enabled_inverts_current_state() -> None:
    """If enabled is omitted, route should invert current task state."""
    task_id = uuid4()
    current_user = SimpleNamespace(id=uuid4())
    existing = _build_task(enabled=True)
    toggled = _build_task(enabled=False)

    schedule_service = SimpleNamespace(
        get_task=AsyncMock(return_value=existing),
        toggle_enabled=AsyncMock(return_value=toggled),
    )
    db = AsyncMock()

    response = await toggle_scheduled_task(
        task_id=task_id,
        current_user=current_user,
        schedule_service=schedule_service,
        db=db,
        enabled=None,
    )

    assert response.enabled is False
    schedule_service.get_task.assert_awaited_once_with(task_id, current_user.id)
    schedule_service.toggle_enabled.assert_awaited_once_with(task_id, current_user.id, False)
    db.commit.assert_awaited_once()
