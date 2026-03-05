"""Tests for JobService ingestion external-analysis behavior."""

from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

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
async def test_ingest_jobs_external_analysis_with_qa_tracks_drift(job_service: JobService) -> None:
    """External analysis should be stored while QA tracks drift against internal scoring."""
    user_id = uuid4()
    raw_job = RawJob(
        title="Backend Engineer",
        company="Acme",
        job_url="https://jobs.example.com/1",
        description="Build backend APIs",
    )

    with (
        patch("app.services.job.job_repo") as mock_repo,
        patch("app.pipelines.actions.job_search.analyzer.analyze_job") as mock_analyze,
    ):
        mock_repo.get_by_url_and_user = AsyncMock(return_value=None)
        mock_repo.create_bulk = AsyncMock(return_value=[SimpleNamespace(id=uuid4())])
        mock_analyze.return_value = SimpleNamespace(
            relevance_score=5.0,
            reasoning="Internal QA score",
        )

        result = await job_service.ingest_jobs(
            user_id=user_id,
            jobs=[raw_job],
            ingestion_source="manual",
            resume_text="Senior backend engineer resume",
            min_score=7.0,
            external_analysis_by_url={
                raw_job.job_url: {
                    "relevance_score": 9.0,
                    "reasoning": "Strong external fit",
                }
            },
            qa_with_internal_analysis=True,
            qa_score_drift_threshold=2.0,
        )

    assert result.jobs_received == 1
    assert result.jobs_analyzed == 1
    assert result.jobs_saved == 1
    assert result.high_scoring == 1
    assert result.qa_jobs_checked == 1
    assert result.qa_large_score_drift == 1
    assert mock_analyze.await_count == 1

    jobs_data = mock_repo.create_bulk.await_args.args[2]
    assert jobs_data[0]["relevance_score"] == 9.0
    assert jobs_data[0]["reasoning"] == "Strong external fit"


@pytest.mark.anyio
async def test_ingest_jobs_invalid_external_analysis_falls_back_to_internal(
    job_service: JobService,
) -> None:
    """Invalid external analysis payload should not raise and should fallback to internal analysis."""
    user_id = uuid4()
    raw_job = RawJob(
        title="Platform Engineer",
        company="Acme",
        job_url="https://jobs.example.com/2",
        description="Build platform systems",
    )

    with (
        patch("app.services.job.job_repo") as mock_repo,
        patch("app.pipelines.actions.job_search.analyzer.analyze_job") as mock_analyze,
    ):
        mock_repo.get_by_url_and_user = AsyncMock(return_value=None)
        mock_repo.create_bulk = AsyncMock(return_value=[SimpleNamespace(id=uuid4())])
        mock_analyze.return_value = SimpleNamespace(
            relevance_score=8.2,
            reasoning="Internal fallback score",
        )

        result = await job_service.ingest_jobs(
            user_id=user_id,
            jobs=[raw_job],
            ingestion_source="manual",
            resume_text="Platform engineer resume",
            min_score=7.0,
            external_analysis_by_url={
                raw_job.job_url: {
                    "reasoning": "Missing score should trigger fallback",
                }
            },
            qa_with_internal_analysis=True,
        )

    assert result.jobs_received == 1
    assert result.jobs_analyzed == 1
    assert result.jobs_saved == 1
    assert result.high_scoring == 1
    assert result.qa_jobs_checked == 0
    assert result.qa_large_score_drift == 0
    assert mock_analyze.await_count == 1
