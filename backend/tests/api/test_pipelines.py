"""Tests for pipeline listing API routes."""

from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient

from app.api.routes.v1 import pipelines as pipeline_routes
from app.core.config import settings


@pytest.mark.anyio
async def test_list_pipelines_accepts_repeated_tag_filters(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The pipelines route should accept repeated tag query params."""
    filtered = MagicMock(return_value=[])
    monkeypatch.setattr(pipeline_routes, "list_pipelines_filtered", filtered)

    response = await client.get(f"{settings.API_V1_STR}/pipelines?area=jobs&tags=ai&tags=writing")

    assert response.status_code == 200
    filtered.assert_called_once_with(area="jobs", tags=["ai", "writing"])


@pytest.mark.anyio
async def test_list_pipelines_accepts_comma_separated_tag_filters(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The pipelines route should remain compatible with legacy comma-separated tags."""
    filtered = MagicMock(return_value=[])
    monkeypatch.setattr(pipeline_routes, "list_pipelines_filtered", filtered)

    response = await client.get(f"{settings.API_V1_STR}/pipelines?tags=ai,writing")

    assert response.status_code == 200
    filtered.assert_called_once_with(area=None, tags=["ai", "writing"])
