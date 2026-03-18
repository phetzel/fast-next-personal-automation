"""Tests for JobService ingestion external-analysis behavior."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.db.models.job import JobStatus
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
        saved_job_id = uuid4()
        mock_repo.create_bulk = AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=saved_job_id,
                    has_application_analysis=False,
                    is_prep_eligible=False,
                )
            ]
        )

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
    assert result.saved_job_ids == [saved_job_id]
    assert result.analyzed_job_ids == []

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
        saved_job_id = uuid4()
        mock_repo.create_bulk = AsyncMock(
            return_value=[
                SimpleNamespace(
                    id=saved_job_id,
                    has_application_analysis=False,
                    is_prep_eligible=False,
                )
            ]
        )

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
    assert result.saved_job_ids == [saved_job_id]

    jobs_data = mock_repo.create_bulk.await_args.args[2]
    assert "relevance_score" not in jobs_data[0]
    assert jobs_data[0]["reasoning"] == "Optional reasoning without score is ignored"


@pytest.mark.anyio
async def test_ingest_jobs_updates_existing_job_with_explicit_application_analysis(
    job_service: JobService,
) -> None:
    """Duplicate ingest should update an existing job when richer analysis arrives."""
    user_id = uuid4()
    raw_job = RawJob(
        title="Backend Engineer",
        company="Acme",
        job_url="https://jobs.example.com/3",
        description="Build backend APIs",
    )
    existing_job = SimpleNamespace(
        id=uuid4(),
        job_status=JobStatus.NEW,
        status="new",
        title="Backend Engineer",
        company="Acme",
        location=None,
        description=None,
        salary_range=None,
        date_posted=None,
        source=None,
        ingestion_source="openclaw",
        is_remote=None,
        job_type=None,
        company_url=None,
        profile_id=None,
        search_terms=None,
        relevance_score=None,
        reasoning=None,
        application_type=None,
        application_url=None,
        requires_cover_letter=None,
        cover_letter_requested=None,
        requires_resume=None,
        detected_fields=None,
        screening_questions=None,
        analyzed_at=None,
        has_application_analysis=True,
        is_prep_eligible=True,
    )

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_url_and_user = AsyncMock(return_value=existing_job)
        mock_repo.update = AsyncMock(return_value=existing_job)

        result = await job_service.ingest_jobs(
            user_id=user_id,
            jobs=[raw_job],
            ingestion_source="openclaw",
            job_attributes_by_url={
                raw_job.job_url: {
                    "application_type": "ats",
                    "application_url": "https://boards.example.com/apply/123",
                    "requires_cover_letter": True,
                    "cover_letter_requested": True,
                    "analyzed_at": datetime.now(UTC),
                    "status": "analyzed",
                }
            },
        )

    assert result.jobs_saved == 0
    assert result.jobs_updated == 1
    assert result.updated_job_ids == [existing_job.id]
    assert result.prep_eligible_job_ids == [existing_job.id]
    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["application_type"] == "ats"
    assert update_data["cover_letter_requested"] is True
    assert update_data["status"] == "analyzed"


@pytest.mark.anyio
async def test_ingest_jobs_monotonically_merges_existing_application_analysis(
    job_service: JobService,
) -> None:
    """Duplicate ingest should enrich existing analysis without weakening it."""
    user_id = uuid4()
    raw_job = RawJob(
        title="Platform Engineer",
        company="Acme",
        job_url="https://jobs.example.com/4",
        description="Build internal platform tooling",
    )
    existing_job = SimpleNamespace(
        id=uuid4(),
        job_status=JobStatus.ANALYZED,
        status="analyzed",
        title="Platform Engineer",
        company="Acme",
        location=None,
        description="Existing job description",
        salary_range=None,
        date_posted=None,
        source=None,
        ingestion_source="openclaw",
        is_remote=None,
        job_type=None,
        company_url=None,
        profile_id=None,
        search_terms=None,
        relevance_score=None,
        reasoning=None,
        application_type="ats",
        application_url="https://boards.example.com/apply/123",
        requires_cover_letter=True,
        cover_letter_requested=True,
        requires_resume=True,
        detected_fields={"resume": {"required": True}},
        screening_questions=[{"question": "Why this company?"}],
        ats_family=None,
        analysis_source="ats_api",
        analyzed_at=datetime(2026, 3, 17, tzinfo=UTC),
        has_application_analysis=True,
        is_prep_eligible=True,
        job_url=raw_job.job_url,
    )

    updated_job = SimpleNamespace(
        id=existing_job.id,
        has_application_analysis=True,
        is_prep_eligible=True,
    )

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_url_and_user = AsyncMock(return_value=existing_job)
        mock_repo.update = AsyncMock(return_value=updated_job)

        result = await job_service.ingest_jobs(
            user_id=user_id,
            jobs=[raw_job],
            ingestion_source="openclaw",
            job_attributes_by_url={
                raw_job.job_url: {
                    "application_type": "unknown",
                    "application_url": raw_job.job_url,
                    "requires_cover_letter": False,
                    "cover_letter_requested": False,
                    "requires_resume": False,
                    "detected_fields": {"cover_letter": {"required": True}},
                    "screening_questions": [{"question": "Describe a recent project."}],
                    "ats_family": "greenhouse",
                    "analysis_source": "openclaw",
                    "analyzed_at": datetime(2026, 3, 18, tzinfo=UTC),
                    "status": "analyzed",
                }
            },
        )

    assert result.jobs_saved == 0
    assert result.jobs_updated == 1
    assert result.updated_job_ids == [existing_job.id]
    assert result.analyzed_job_ids == [existing_job.id]
    assert result.prep_eligible_job_ids == [existing_job.id]

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert "application_type" not in update_data
    assert "application_url" not in update_data
    assert "requires_cover_letter" not in update_data
    assert "cover_letter_requested" not in update_data
    assert "requires_resume" not in update_data
    assert "analysis_source" not in update_data
    assert "analyzed_at" not in update_data
    assert update_data["ats_family"] == "greenhouse"
    assert update_data["detected_fields"] == {
        "resume": {"required": True},
        "cover_letter": {"required": True},
    }
    assert update_data["screening_questions"] == [
        {"question": "Why this company?"},
        {"question": "Describe a recent project."},
    ]


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
