"""Tests for job listing API routes."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.deps import get_current_user, get_job_service
from app.db.models.job import JobStatus
from app.main import app


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> None:
    """Ensure dependency overrides are reset between tests."""
    yield
    app.dependency_overrides.clear()


def _mock_user() -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        email="jobs@example.com",
        full_name="Jobs User",
        is_active=True,
        is_superuser=False,
        role="user",
        created_at=now,
        updated_at=now,
    )


@pytest.mark.anyio
async def test_list_jobs_accepts_multi_status_filters(client) -> None:
    """The jobs list route should parse repeated status params into JobFilters.statuses."""
    user = _mock_user()
    job_service = SimpleNamespace(get_by_user=AsyncMock(return_value=([], 0)))

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_job_service] = lambda: job_service

    response = await client.get("/api/v1/jobs?statuses=new&statuses=analyzed&page=2")

    assert response.status_code == 200
    job_service.get_by_user.assert_awaited_once()

    args = job_service.get_by_user.await_args.args
    assert args[0] == user.id
    assert args[1].statuses == [JobStatus.NEW, JobStatus.ANALYZED]
    assert args[1].page == 2
