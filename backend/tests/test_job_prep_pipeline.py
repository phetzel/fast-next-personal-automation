"""Tests for the job prep pipeline behavior."""

from contextlib import asynccontextmanager
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.db.models.job import JobStatus
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.actions.job_prep.generator import PrepOutput
from app.pipelines.actions.job_prep.pipeline import JobPrepInput, JobPrepPipeline


def _mock_job(user_id):
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        title="Backend Engineer",
        company="Acme",
        description="Build reliable APIs",
        job_status=JobStatus.ANALYZED,
        status=JobStatus.ANALYZED.value,
        requires_cover_letter=False,
        screening_questions=[{"question": "Why this company?"}],
        reasoning="Strong fit based on backend systems work.",
        application_type="ats",
        source="linkedin",
        cover_letter=None,
        cover_letter_file_path=None,
        cover_letter_generated_at=None,
    )


def _mock_profile(user_id, profile_id=None, *, name="Primary Profile"):
    return SimpleNamespace(
        id=profile_id or uuid4(),
        user_id=user_id,
        name=name,
        resume=SimpleNamespace(text_content="Backend engineer resume text", name="resume.pdf"),
        story=None,
        project_ids=None,
        contact_full_name="Phillip Hetzel",
        contact_email="phetzel89@gmail.com",
        contact_phone=None,
        contact_location=None,
        contact_website=None,
        target_roles=[],
        min_score_threshold=50,
    )


@pytest.fixture
def pipeline() -> JobPrepPipeline:
    return JobPrepPipeline()


@pytest.fixture
def db() -> AsyncMock:
    return AsyncMock()


def _db_context(db):
    @asynccontextmanager
    async def _context():
        yield db

    return _context


@pytest.mark.anyio
async def test_job_prep_persists_explicit_profile_and_screening_answers(
    pipeline: JobPrepPipeline,
    db: AsyncMock,
) -> None:
    """Prep should save the selected profile and screening answers from one generation pass."""
    user_id = uuid4()
    job = _mock_job(user_id)
    profile = _mock_profile(user_id)
    prep_output = PrepOutput(
        cover_letter=None,
        prep_notes="# Prep Notes\n\n- Ship practical systems",
        screening_answers={"Why this company?": "The role matches my automation background."},
    )

    with (
        patch("app.pipelines.actions.job_prep.pipeline.get_db_context", _db_context(db)),
        patch("app.pipelines.actions.job_prep.pipeline.job_repo") as mock_job_repo,
        patch("app.pipelines.actions.job_prep.pipeline.job_profile_repo") as mock_profile_repo,
        patch(
            "app.pipelines.actions.job_prep.pipeline.generate_prep_materials",
            AsyncMock(return_value=prep_output),
        ) as mock_generate_prep,
    ):
        mock_job_repo.get_by_id_and_user = AsyncMock(side_effect=[job, job])
        mock_job_repo.update = AsyncMock(return_value=job)
        mock_profile_repo.get_by_id = AsyncMock(return_value=profile)

        result = await pipeline.execute(
            JobPrepInput(job_id=job.id, profile_id=profile.id),
            PipelineContext(source=PipelineSource.API, user_id=user_id),
        )

    assert result.success is True
    assert result.output is not None
    assert result.output.screening_answers == prep_output.screening_answers
    assert result.output.profile_used == profile.name
    mock_generate_prep.assert_awaited_once()
    update_data = mock_job_repo.update.await_args.kwargs["update_data"]
    assert update_data["profile_id"] == profile.id
    assert update_data["screening_answers"] == prep_output.screening_answers
    assert update_data["status"] == JobStatus.PREPPED.value
    assert update_data["cover_letter"] is None
    assert update_data["cover_letter_file_path"] is None
    assert update_data["cover_letter_generated_at"] is None
    db.commit.assert_awaited()


@pytest.mark.anyio
async def test_job_prep_persists_default_profile_when_none_selected(
    pipeline: JobPrepPipeline,
    db: AsyncMock,
) -> None:
    """Prep should store the resolved default profile on the job when no profile is selected."""
    user_id = uuid4()
    job = _mock_job(user_id)
    default_profile = _mock_profile(user_id, name="Default Profile")
    prep_output = PrepOutput(
        cover_letter=None,
        prep_notes="# Prep Notes\n\n- Highlight systems work",
        screening_answers={},
    )

    with (
        patch("app.pipelines.actions.job_prep.pipeline.get_db_context", _db_context(db)),
        patch("app.pipelines.actions.job_prep.pipeline.job_repo") as mock_job_repo,
        patch("app.pipelines.actions.job_prep.pipeline.job_profile_repo") as mock_profile_repo,
        patch(
            "app.pipelines.actions.job_prep.pipeline.generate_prep_materials",
            AsyncMock(return_value=prep_output),
        ),
    ):
        mock_job_repo.get_by_id_and_user = AsyncMock(side_effect=[job, job])
        mock_job_repo.update = AsyncMock(return_value=job)
        mock_profile_repo.get_default_for_user = AsyncMock(return_value=default_profile)

        result = await pipeline.execute(
            JobPrepInput(job_id=job.id),
            PipelineContext(source=PipelineSource.API, user_id=user_id),
        )

    assert result.success is True
    assert result.output is not None
    assert result.output.profile_used == default_profile.name
    update_data = mock_job_repo.update.await_args.kwargs["update_data"]
    assert update_data["profile_id"] == default_profile.id
    assert update_data["status"] == JobStatus.PREPPED.value
