"""Tests for worker and scheduler integration."""

import importlib
from unittest.mock import AsyncMock

import pytest

from app.pipelines.registry import clear_registry, list_pipeline_names
from app.worker.schedule_source import DatabaseScheduleSource


class TestDatabaseScheduleSource:
    """Tests for database-backed schedule source behavior."""

    @pytest.mark.anyio
    async def test_get_schedules_refreshes_from_database(self) -> None:
        """Ensure source refreshes before returning cached schedules."""
        source = DatabaseScheduleSource()
        source._refresh_schedules = AsyncMock()

        await source.get_schedules()

        source._refresh_schedules.assert_awaited_once()


class TestWorkerPipelineDiscovery:
    """Tests for worker-side pipeline discovery."""

    def test_worker_import_registers_action_pipelines(self) -> None:
        """Importing taskiq app should register pipelines for scheduled execution."""
        clear_registry()
        import app.worker.taskiq_app as taskiq_app

        importlib.reload(taskiq_app)

        pipeline_names = set(list_pipeline_names())
        assert "job_prep" in pipeline_names
        assert "job_search" in pipeline_names
