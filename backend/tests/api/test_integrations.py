"""Tests for OpenClaw integration API routes."""

from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from app.api.deps import (
    get_current_user,
    get_integration_token_service,
    get_job_service,
    verify_openclaw_analyze_token,
    verify_openclaw_apply_token,
    verify_openclaw_prep_token,
    verify_openclaw_token,
)
from app.main import app
from app.services.job import IngestionResult


@pytest.fixture(autouse=True)
def clear_dependency_overrides() -> None:
    """Ensure dependency overrides are reset between tests."""
    yield
    app.dependency_overrides.clear()


def _mock_user() -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        email="integration@example.com",
        full_name="Integration User",
        is_active=True,
        is_superuser=False,
        role="user",
        created_at=now,
        updated_at=now,
    )


def _mock_token(user_id, scopes: list[str] | None = None) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        name="OpenClaw Prod",
        scopes=scopes or ["jobs:ingest"],
        is_active=True,
        created_at=now,
        updated_at=now,
        last_used_at=None,
        expires_at=None,
    )


def _mock_job(user_id, *, status: str = "new") -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        profile_id=None,
        title="Backend Engineer",
        company="Acme",
        location="Remote",
        description="Build APIs",
        job_url="https://jobs.example.com/1",
        salary_range=None,
        date_posted=None,
        source="greenhouse",
        ingestion_source="openclaw",
        relevance_score=8.5,
        reasoning="Strong fit",
        status=status,
        search_terms=None,
        notes=None,
        cover_letter=None,
        cover_letter_file_path=None,
        cover_letter_generated_at=None,
        prep_notes=None,
        prepped_at=None,
        application_type="ats" if status != "new" else None,
        application_url="https://boards.example.com/apply/123" if status != "new" else None,
        requires_cover_letter=True if status != "new" else None,
        requires_resume=True if status != "new" else None,
        detected_fields=None,
        screening_questions=[],
        screening_answers=None,
        analyzed_at=now if status != "new" else None,
        applied_at=None,
        application_method=None,
        confirmation_code=None,
        created_at=now,
        updated_at=now,
    )


@pytest.mark.anyio
async def test_create_openclaw_token(client, mock_db_session) -> None:
    """Creating token should return plaintext once and commit."""
    user = _mock_user()
    created_token = _mock_token(user.id)
    token_service = SimpleNamespace(
        create_openclaw_token=AsyncMock(return_value=(created_token, "oct_secret_value"))
    )

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_integration_token_service] = lambda: token_service

    response = await client.post(
        "/api/v1/integrations/openclaw/tokens",
        json={"name": "OpenClaw Prod"},
    )

    assert response.status_code == 201
    data = response.json()
    assert data["token"] == "oct_secret_value"
    assert data["token_info"]["name"] == "OpenClaw Prod"
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_list_openclaw_tokens(client) -> None:
    """Listing tokens should return the current user's scoped tokens."""
    user = _mock_user()
    tokens = [_mock_token(user.id), _mock_token(user.id)]
    token_service = SimpleNamespace(list_tokens_for_user=AsyncMock(return_value=tokens))

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_integration_token_service] = lambda: token_service

    response = await client.get("/api/v1/integrations/openclaw/tokens")

    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert [item["id"] for item in data["items"]] == [str(token.id) for token in tokens]
    token_service.list_tokens_for_user.assert_awaited_once_with(user.id)


@pytest.mark.anyio
async def test_revoke_openclaw_token(client, mock_db_session) -> None:
    """Revoking a token should call the token service and commit."""
    user = _mock_user()
    token = _mock_token(user.id)
    token_service = SimpleNamespace(revoke_token_for_user=AsyncMock(return_value=token))

    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_integration_token_service] = lambda: token_service

    response = await client.delete(f"/api/v1/integrations/openclaw/tokens/{token.id}")

    assert response.status_code == 204
    token_service.revoke_token_for_user.assert_awaited_once_with(token.id, user.id)
    mock_db_session.commit.assert_awaited_once()


@pytest.mark.anyio
async def test_ingest_openclaw_jobs_success(client, mock_db_session) -> None:
    """Ingest endpoint should map jobs and call unified ingestion service."""
    user = _mock_user()
    token = _mock_token(user.id)
    job_service = SimpleNamespace(
        ingest_jobs=AsyncMock(
            return_value=IngestionResult(
                jobs_received=2,
                jobs_analyzed=0,
                jobs_saved=2,
                duplicates_skipped=0,
                high_scoring=0,
            )
        )
    )

    app.dependency_overrides[verify_openclaw_token] = lambda: token
    app.dependency_overrides[get_job_service] = lambda: job_service

    from app.api.routes.v1 import integrations as integrations_route

    original_get_default_for_user = integrations_route.job_profile_repo.get_default_for_user
    integrations_route.job_profile_repo.get_default_for_user = AsyncMock(return_value=None)

    try:
        response = await client.post(
            "/api/v1/integrations/openclaw/jobs/ingest",
            json={
                "jobs": [
                    {
                        "title": "Backend Engineer",
                        "company": "Acme",
                        "job_url": "https://jobs.example.com/1",
                        "source": "greenhouse",
                    },
                    {
                        "title": "Platform Engineer",
                        "company": "Acme",
                        "job_url": "https://jobs.example.com/2",
                        "source": "lever",
                    },
                ]
            },
        )
    finally:
        integrations_route.job_profile_repo.get_default_for_user = original_get_default_for_user

    assert response.status_code == 200
    data = response.json()
    assert data["jobs_saved"] == 2
    assert data["analysis_enabled"] is False
    assert data["token_id"] == str(token.id)
    job_service.ingest_jobs.assert_awaited_once()
    kwargs = job_service.ingest_jobs.await_args.kwargs
    assert kwargs["ingestion_source"] == "openclaw"
    assert kwargs["user_id"] == token.user_id
    assert len(kwargs["jobs"]) == 2
    mock_db_session.commit.assert_awaited()


@pytest.mark.anyio
async def test_ingest_openclaw_jobs_profile_without_resume_returns_422(client) -> None:
    """Explicit profile with no resume text should fail validation."""
    user = _mock_user()
    token = _mock_token(user.id)

    profile = SimpleNamespace(id=uuid4(), user_id=user.id, resume=None, name="Default")

    app.dependency_overrides[verify_openclaw_token] = lambda: token

    from app.api.routes.v1 import integrations as integrations_route

    original_get_by_id = integrations_route.job_profile_repo.get_by_id
    integrations_route.job_profile_repo.get_by_id = AsyncMock(return_value=profile)

    try:
        response = await client.post(
            "/api/v1/integrations/openclaw/jobs/ingest",
            json={
                "profile_id": str(profile.id),
                "jobs": [
                    {
                        "title": "Backend Engineer",
                        "company": "Acme",
                        "job_url": "https://jobs.example.com/1",
                    }
                ],
            },
        )
    finally:
        integrations_route.job_profile_repo.get_by_id = original_get_by_id

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


@pytest.mark.anyio
async def test_ingest_openclaw_jobs_uses_external_analysis_payload(client, mock_db_session) -> None:
    """External score/reasoning should be forwarded to unified ingestion service."""
    user = _mock_user()
    token = _mock_token(user.id)
    job_service = SimpleNamespace(
        ingest_jobs=AsyncMock(
            return_value=IngestionResult(
                jobs_received=1,
                jobs_analyzed=1,
                jobs_saved=1,
                duplicates_skipped=0,
                high_scoring=1,
            )
        )
    )

    app.dependency_overrides[verify_openclaw_token] = lambda: token
    app.dependency_overrides[get_job_service] = lambda: job_service

    response = await client.post(
        "/api/v1/integrations/openclaw/jobs/ingest",
        json={
            "analyze_with_profile": False,
            "jobs": [
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "job_url": "https://jobs.example.com/1",
                    "source": "greenhouse",
                    "relevance_score": 9.1,
                    "reasoning": "Strong Python/FastAPI fit with relevant backend depth.",
                }
            ],
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["jobs_analyzed"] == 1
    assert data["external_analysis_used"] is True
    assert data["qa_with_internal_analysis"] is False

    kwargs = job_service.ingest_jobs.await_args.kwargs
    assert kwargs["external_analysis_by_url"] == {
        "https://jobs.example.com/1": {
            "relevance_score": 9.1,
            "reasoning": "Strong Python/FastAPI fit with relevant backend depth.",
        }
    }
    assert kwargs["job_attributes_by_url"] == {}
    assert kwargs["qa_with_internal_analysis"] is False
    mock_db_session.commit.assert_awaited()


@pytest.mark.anyio
async def test_ingest_openclaw_jobs_requires_score_when_reasoning_present(client) -> None:
    """Payload validation should reject reasoning without a relevance score."""
    user = _mock_user()
    token = _mock_token(user.id)
    app.dependency_overrides[verify_openclaw_token] = lambda: token

    response = await client.post(
        "/api/v1/integrations/openclaw/jobs/ingest",
        json={
            "jobs": [
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "job_url": "https://jobs.example.com/1",
                    "reasoning": "Great fit",
                }
            ]
        },
    )

    assert response.status_code == 422
    body = response.json()
    if "error" in body:
        assert body["error"]["code"] == "VALIDATION_ERROR"
    else:
        assert body["detail"]


@pytest.mark.anyio
async def test_ingest_openclaw_jobs_can_save_directly_as_analyzed(client) -> None:
    """Application-analysis payload should be forwarded and marked analyzed."""
    user = _mock_user()
    token = _mock_token(user.id)
    job_service = SimpleNamespace(
        ingest_jobs=AsyncMock(
            return_value=IngestionResult(
                jobs_received=1,
                jobs_analyzed=1,
                jobs_saved=1,
                duplicates_skipped=0,
                high_scoring=1,
            )
        )
    )

    app.dependency_overrides[verify_openclaw_token] = lambda: token
    app.dependency_overrides[get_job_service] = lambda: job_service

    response = await client.post(
        "/api/v1/integrations/openclaw/jobs/ingest",
        json={
            "analyze_with_profile": False,
            "jobs": [
                {
                    "title": "Backend Engineer",
                    "company": "Acme",
                    "job_url": "https://jobs.example.com/1",
                    "description": "Full job description",
                    "application_type": "ats",
                    "application_url": "https://boards.example.com/apply/123",
                    "requires_cover_letter": True,
                    "screening_questions": [{"label": "Why Acme?"}],
                }
            ],
        },
    )

    assert response.status_code == 200
    kwargs = job_service.ingest_jobs.await_args.kwargs
    assert kwargs["job_attributes_by_url"]["https://jobs.example.com/1"]["status"] == "analyzed"
    assert (
        kwargs["job_attributes_by_url"]["https://jobs.example.com/1"]["requires_cover_letter"]
        is True
    )


@pytest.mark.anyio
async def test_analyze_openclaw_job_route(client) -> None:
    """Analyze route should update application analysis for the token's user."""
    user = _mock_user()
    token = _mock_token(user.id, scopes=["jobs:analyze"])
    updated_job = _mock_job(user.id, status="analyzed")
    job_service = SimpleNamespace(update_application_analysis=AsyncMock(return_value=updated_job))

    app.dependency_overrides[verify_openclaw_analyze_token] = lambda: token
    app.dependency_overrides[get_job_service] = lambda: job_service

    response = await client.post(
        f"/api/v1/integrations/openclaw/jobs/{updated_job.id}/analyze",
        json={
            "application_type": "ats",
            "application_url": "https://boards.example.com/apply/123",
            "requires_cover_letter": True,
        },
    )

    assert response.status_code == 200
    job_service.update_application_analysis.assert_awaited_once()
    kwargs = job_service.update_application_analysis.await_args.kwargs
    assert kwargs["application_type"] == "ats"
    assert kwargs["application_url"] == "https://boards.example.com/apply/123"


@pytest.mark.anyio
async def test_openclaw_prep_batch_route_executes_pipeline(client) -> None:
    """Prep-batch route should execute the internal batch prep pipeline."""
    user = _mock_user()
    token = _mock_token(user.id, scopes=["jobs:prep"])

    app.dependency_overrides[verify_openclaw_prep_token] = lambda: token

    from app.api.routes.v1 import integrations as integrations_route

    original_execute_pipeline = integrations_route.execute_pipeline
    integrations_route.execute_pipeline = AsyncMock(
        return_value=SimpleNamespace(
            success=True,
            output=SimpleNamespace(
                model_dump=lambda mode="json": {
                    "total_processed": 1,
                    "successful": 1,
                    "failed": 0,
                    "skipped": 0,
                    "results": [],
                }
            ),
            error=None,
            metadata={"jobs_found": 1},
        )
    )

    try:
        response = await client.post(
            "/api/v1/integrations/openclaw/jobs/prep-batch",
            json={"max_jobs": 5, "tone": "professional"},
        )
    finally:
        integrations_route.execute_pipeline = original_execute_pipeline

    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["output"]["successful"] == 1


@pytest.mark.anyio
async def test_openclaw_apply_success_route(client) -> None:
    """Apply-success route should mark a reviewed job as applied."""
    user = _mock_user()
    token = _mock_token(user.id, scopes=["jobs:apply"])
    applied_job = _mock_job(user.id, status="applied")
    applied_job.applied_at = datetime.now(UTC)
    applied_job.application_method = "openclaw"
    applied_job.confirmation_code = "ABC123"

    job_service = SimpleNamespace(mark_job_applied=AsyncMock(return_value=applied_job))

    app.dependency_overrides[verify_openclaw_apply_token] = lambda: token
    app.dependency_overrides[get_job_service] = lambda: job_service

    response = await client.post(
        f"/api/v1/integrations/openclaw/jobs/{applied_job.id}/apply-success",
        json={
            "application_method": "openclaw",
            "confirmation_code": "ABC123",
            "notes": "Submitted successfully",
        },
    )

    assert response.status_code == 200
    kwargs = job_service.mark_job_applied.await_args.kwargs
    assert kwargs["application_method"] == "openclaw"
    assert kwargs["confirmation_code"] == "ABC123"
