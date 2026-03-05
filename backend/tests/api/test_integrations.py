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


def _mock_token(user_id) -> SimpleNamespace:
    now = datetime.now(UTC)
    return SimpleNamespace(
        id=uuid4(),
        user_id=user_id,
        name="OpenClaw Prod",
        scopes=["jobs:ingest"],
        is_active=True,
        created_at=now,
        updated_at=now,
        last_used_at=None,
        expires_at=None,
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
    assert kwargs["ingestion_source"] == "manual"
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
