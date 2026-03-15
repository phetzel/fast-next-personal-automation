"""Tests for JobService ingestion external-analysis behavior."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.schemas.job import ManualJobCreateRequest
from app.schemas.job_data import RawJob
from app.services.job import JobService


@pytest.fixture
def mock_db() -> AsyncMock:
    """Create mock database session."""
    return AsyncMock()


@pytest.fixture
def job_service(mock_db: AsyncMock) -> JobService:
    """Create JobService with mocked DB session."""
    return JobService(mock_db)


@pytest.mark.anyio
async def test_ingest_jobs_persists_external_score_when_present(job_service: JobService) -> None:
    """External score/reasoning should be stored without any internal fallback."""
    user_id = uuid4()
    raw_job = RawJob(
        title="Backend Engineer",
        company="Acme",
        job_url="https://jobs.example.com/1",
        description="Build backend APIs",
    )

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_url_and_user = AsyncMock(return_value=None)
        mock_repo.create_bulk = AsyncMock(return_value=[SimpleNamespace(id=uuid4())])

        result = await job_service.ingest_jobs(
            user_id=user_id,
            jobs=[raw_job],
            ingestion_source="manual",
            external_analysis_by_url={
                raw_job.job_url: {
                    "relevance_score": 9.0,
                    "reasoning": "Strong external fit",
                }
            },
        )

    assert result.jobs_received == 1
    assert result.jobs_analyzed == 1
    assert result.jobs_saved == 1
    assert result.high_scoring == 1

    jobs_data = mock_repo.create_bulk.await_args.args[2]
    assert jobs_data[0]["relevance_score"] == 9.0
    assert jobs_data[0]["reasoning"] == "Strong external fit"


@pytest.mark.anyio
async def test_ingest_jobs_allows_unscored_jobs(job_service: JobService) -> None:
    """Jobs without external scoring should still be saved with null score fields."""
    user_id = uuid4()
    raw_job = RawJob(
        title="Platform Engineer",
        company="Acme",
        job_url="https://jobs.example.com/2",
        description="Build platform systems",
    )

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_url_and_user = AsyncMock(return_value=None)
        mock_repo.create_bulk = AsyncMock(return_value=[SimpleNamespace(id=uuid4())])

        result = await job_service.ingest_jobs(
            user_id=user_id,
            jobs=[raw_job],
            ingestion_source="openclaw",
            external_analysis_by_url={
                raw_job.job_url: {
                    "reasoning": "Optional reasoning without score is ignored",
                }
            },
        )

    assert result.jobs_received == 1
    assert result.jobs_analyzed == 0
    assert result.jobs_saved == 1
    assert result.high_scoring == 0

    jobs_data = mock_repo.create_bulk.await_args.args[2]
    assert "relevance_score" not in jobs_data[0]
    assert jobs_data[0]["reasoning"] == "Optional reasoning without score is ignored"


@pytest.mark.anyio
async def test_create_manual_job_allows_missing_profile(job_service: JobService) -> None:
    """Manual jobs should save without requiring profile-based scoring."""
    user_id = uuid4()
    created_job = SimpleNamespace(id=uuid4())

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_url_and_user = AsyncMock(return_value=None)
        mock_repo.create = AsyncMock(return_value=created_job)

        result = await job_service.create_manual_job(
            user_id,
            ManualJobCreateRequest(
                title="Backend Engineer",
                company="Acme",
                job_url="https://jobs.example.com/manual",
            ),
        )

    assert result == created_job
    kwargs = mock_repo.create.await_args.kwargs
    assert kwargs["profile_id"] is None
    assert kwargs["ingestion_source"] == "manual"
