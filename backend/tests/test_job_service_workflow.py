"""Tests for JobService workflow transitions and analysis stages."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import ValidationError
from app.db.models.job import JobStatus
from app.services.job import JobService


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database session."""
    return AsyncMock()


@pytest.fixture
def job_service(mock_db: AsyncMock) -> JobService:
    """Create JobService with mocked DB session."""
    return JobService(mock_db)


def _mock_job(*, status: JobStatus, user_id=None):
    user_id = user_id or uuid4()
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        title="Backend Engineer",
        company="Acme",
        job_url="https://jobs.example.com/1",
        status=status.value,
        notes=None,
        applied_at=None,
    )


@pytest.mark.anyio
async def test_update_status_rejects_skipping_analyzed(job_service: JobService) -> None:
    """Server-side transitions should reject new -> prepped."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.NEW, user_id=user_id)

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock()

        with pytest.raises(ValidationError, match="Invalid job status transition"):
            await job_service.update_status(job.id, user_id, JobStatus.PREPPED)

    mock_repo.update.assert_not_awaited()


@pytest.mark.anyio
async def test_update_application_analysis_moves_new_job_to_analyzed(
    job_service: JobService,
) -> None:
    """Application analysis should advance NEW jobs into ANALYZED."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.NEW, user_id=user_id)

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock(return_value=job)

        await job_service.update_application_analysis(
            job.id,
            user_id,
            application_type="ats",
            application_url="https://boards.example.com/apply/123",
            requires_cover_letter=True,
        )

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["status"] == JobStatus.ANALYZED.value
    assert update_data["application_type"] == "ats"
    assert update_data["requires_cover_letter"] is True
    assert update_data["analyzed_at"] is not None


@pytest.mark.anyio
async def test_manual_analyze_defaults_to_unknown_application_and_cover_letter_off(
    job_service: JobService,
) -> None:
    """Manual analyze should make a new job ready for prep with safe defaults."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.NEW, user_id=user_id)
    job.application_type = None
    job.application_url = None

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock(return_value=job)

        await job_service.manual_analyze(job.id, user_id)

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["status"] == JobStatus.ANALYZED.value
    assert update_data["application_type"] == "unknown"
    assert update_data["application_url"] == job.job_url
    assert update_data["requires_cover_letter"] is False
    assert update_data["screening_questions"] == []
    assert update_data["analyzed_at"] is not None


@pytest.mark.anyio
async def test_manual_analyze_persists_custom_questions(job_service: JobService) -> None:
    """Manual analyze should normalize and store screening questions for prep."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.ANALYZED, user_id=user_id)
    job.application_type = "unknown"
    job.application_url = "https://jobs.example.com/apply"

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock(return_value=job)

        await job_service.manual_analyze(
            job.id,
            user_id,
            requires_cover_letter=True,
            screening_questions=[" Why this company? ", "", "Describe your salary expectations"],
        )

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["requires_cover_letter"] is True
    assert update_data["screening_questions"] == [
        {"question": "Why this company?"},
        {"question": "Describe your salary expectations"},
    ]


@pytest.mark.anyio
async def test_mark_job_applied_sets_tracking_fields(job_service: JobService) -> None:
    """Apply success should write applied tracking data for reviewed jobs."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.REVIEWED, user_id=user_id)
    now = datetime.now(UTC)

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock(return_value=job)

        await job_service.mark_job_applied(
            job.id,
            user_id,
            applied_at=now,
            application_method="openclaw",
            confirmation_code="ABC123",
            notes="Submitted successfully",
        )

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["status"] == JobStatus.APPLIED.value
    assert update_data["applied_at"] == now
    assert update_data["application_method"] == "openclaw"
    assert update_data["confirmation_code"] == "ABC123"
    assert update_data["notes"] == "Submitted successfully"
