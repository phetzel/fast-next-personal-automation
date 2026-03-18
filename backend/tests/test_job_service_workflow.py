"""Tests for JobService workflow transitions and analysis stages."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest

from app.core.exceptions import ValidationError
from app.db.models.job import JobStatus
from app.schemas.job import JobUpdate
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
        profile_id=None,
        title="Backend Engineer",
        company="Acme",
        job_url="https://jobs.example.com/1",
        status=status.value,
        cover_letter="Tailored cover letter body",
        cover_letter_file_path="cover_letters/existing.pdf",
        notes=None,
        applied_at=None,
        application_type=None,
        application_url=None,
        requires_cover_letter=None,
        cover_letter_requested=None,
        requires_resume=None,
        detected_fields=None,
        screening_questions=None,
        ats_family=None,
        analysis_source=None,
        analyzed_at=None,
        has_application_analysis=False,
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
    assert update_data["cover_letter_requested"] is False
    assert update_data["analysis_source"] == "manual"
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
async def test_update_application_analysis_allows_metadata_only_for_existing_analysis(
    job_service: JobService,
) -> None:
    """Metadata-only updates should work once the job already has explicit analysis."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.ANALYZED, user_id=user_id)
    job.has_application_analysis = True
    job.analyzed_at = datetime.now(UTC)

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock(return_value=job)

        await job_service.update_application_analysis(
            job.id,
            user_id,
            ats_family="greenhouse",
            analysis_source="openclaw_browser",
        )

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["ats_family"] == "greenhouse"
    assert update_data["analysis_source"] == "openclaw_browser"
    assert "status" not in update_data


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


@pytest.mark.anyio
async def test_update_allows_direct_move_to_applied_from_new(job_service: JobService) -> None:
    """Manual status updates should allow pre-applied jobs to jump straight to applied."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.NEW, user_id=user_id)

    with patch("app.services.job.job_repo") as mock_repo:
        mock_repo.get_by_id_and_user = AsyncMock(return_value=job)
        mock_repo.update = AsyncMock(return_value=job)

        await job_service.update(job.id, user_id, JobUpdate(status=JobStatus.APPLIED))

    update_data = mock_repo.update.await_args.kwargs["update_data"]
    assert update_data["status"] == JobStatus.APPLIED.value
    assert update_data["applied_at"] is not None


def test_build_contact_info_rejects_missing_name(job_service: JobService) -> None:
    """PDF generation should fail if neither profile nor account has a real full name."""
    user = SimpleNamespace(id=uuid4(), email="user@example.com", full_name="   ")
    profile = SimpleNamespace(
        id=uuid4(),
        contact_full_name=" ",
        contact_email="profile@example.com",
        contact_phone=None,
        contact_location=None,
        contact_website=None,
    )

    with pytest.raises(ValidationError, match="Add a full name"):
        job_service._build_contact_info(user, profile)


def test_build_contact_info_uses_profile_name_before_account_name(job_service: JobService) -> None:
    """Profile cover-letter fields should take precedence when present."""
    user = SimpleNamespace(id=uuid4(), email="user@example.com", full_name="Account Name")
    profile = SimpleNamespace(
        id=uuid4(),
        contact_full_name="Profile Name",
        contact_email=None,
        contact_phone="555-0100",
        contact_location="Portland, OR",
        contact_website="example.com",
    )

    contact = job_service._build_contact_info(user, profile)

    assert contact.full_name == "Profile Name"
    assert contact.email == "user@example.com"
    assert contact.phone == "555-0100"
    assert contact.location == "Portland, OR"
    assert contact.website == "example.com"


@pytest.mark.anyio
async def test_get_cover_letter_pdf_uses_clean_company_slug_filename(
    job_service: JobService,
) -> None:
    """Downloads should expose the clean slugged filename rather than storage internals."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.REVIEWED, user_id=user_id)
    job.company = "Ziff Davis Shopping"
    job.cover_letter_file_path = "cover_letters/uuid-cover-ziff-davis-shopping.pdf"

    storage = AsyncMock()
    storage.load = AsyncMock(return_value=b"%PDF-1.4 fake")

    with (
        patch.object(job_service, "get_by_id", AsyncMock(return_value=job)),
        patch("app.services.job.get_storage_instance", AsyncMock(return_value=storage)),
    ):
        pdf_bytes, filename = await job_service.get_cover_letter_pdf(job.id, user_id)

    assert pdf_bytes == b"%PDF-1.4 fake"
    assert filename == "cover-ziff-davis-shopping.pdf"


@pytest.mark.anyio
async def test_regenerate_cover_letter_pdf_prefers_persisted_job_profile(
    job_service: JobService,
) -> None:
    """Regeneration should reuse the profile saved during prep."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.PREPPED, user_id=user_id)
    job.profile_id = uuid4()
    user = SimpleNamespace(id=user_id, email="user@example.com", full_name="Account Name")
    persisted_profile = SimpleNamespace(id=job.profile_id, user_id=user_id)

    with (
        patch.object(job_service, "get_by_id", AsyncMock(return_value=job)),
        patch("app.services.job.job_profile_repo") as mock_profile_repo,
        patch.object(
            job_service,
            "generate_cover_letter_pdf",
            AsyncMock(return_value=job),
        ) as mock_generate_pdf,
    ):
        mock_profile_repo.get_by_id = AsyncMock(return_value=persisted_profile)
        mock_profile_repo.get_default_for_user = AsyncMock()
        result = await job_service.regenerate_cover_letter_pdf(job.id, user)

    assert result == job
    mock_profile_repo.get_by_id.assert_awaited_once_with(job_service.db, job.profile_id)
    mock_profile_repo.get_default_for_user.assert_not_awaited()
    mock_generate_pdf.assert_awaited_once_with(job.id, user, persisted_profile)


@pytest.mark.anyio
async def test_regenerate_cover_letter_pdf_falls_back_to_default_profile(
    job_service: JobService,
) -> None:
    """Regeneration should fall back to the default profile if the stored one is gone."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.PREPPED, user_id=user_id)
    job.profile_id = uuid4()
    user = SimpleNamespace(id=user_id, email="user@example.com", full_name="Account Name")
    default_profile = SimpleNamespace(id=uuid4(), user_id=user_id)

    with (
        patch.object(job_service, "get_by_id", AsyncMock(return_value=job)),
        patch("app.services.job.job_profile_repo") as mock_profile_repo,
        patch.object(
            job_service,
            "generate_cover_letter_pdf",
            AsyncMock(return_value=job),
        ) as mock_generate_pdf,
    ):
        mock_profile_repo.get_by_id = AsyncMock(return_value=None)
        mock_profile_repo.get_default_for_user = AsyncMock(return_value=default_profile)
        result = await job_service.regenerate_cover_letter_pdf(job.id, user)

    assert result == job
    mock_profile_repo.get_by_id.assert_awaited_once_with(job_service.db, job.profile_id)
    mock_profile_repo.get_default_for_user.assert_awaited_once_with(job_service.db, user_id)
    mock_generate_pdf.assert_awaited_once_with(job.id, user, default_profile)


@pytest.mark.anyio
async def test_generate_cover_letter_pdf_blocks_when_name_missing(job_service: JobService) -> None:
    """Text can exist, but PDF generation should stop without a valid applicant name."""
    user_id = uuid4()
    job = _mock_job(status=JobStatus.PREPPED, user_id=user_id)
    user = SimpleNamespace(id=user_id, email="user@example.com", full_name=" ")
    profile = SimpleNamespace(
        id=uuid4(),
        contact_full_name=" ",
        contact_email=None,
        contact_phone=None,
        contact_location=None,
        contact_website=None,
    )

    with (
        patch.object(job_service, "get_by_id", AsyncMock(return_value=job)),
        pytest.raises(ValidationError, match="Add a full name"),
    ):
        await job_service.generate_cover_letter_pdf(job.id, user, profile)
