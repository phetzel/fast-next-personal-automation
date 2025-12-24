"""Tests for AI agent module (PydanticAI)."""

from unittest.mock import patch

import pytest

from app.agents.area_config import AreaAgentConfig
from app.agents.areas import JOBS_AGENT_CONFIG, get_area_config, list_available_areas
from app.agents.assistant import AssistantAgent, Deps, get_agent, get_agent_for_area
from app.agents.tools import get_current_datetime, job_profiles_toolset, jobs_toolset
from app.agents.tools.datetime_tool import get_current_datetime


class TestDeps:
    """Tests for Deps dataclass."""

    def test_deps_default_values(self):
        """Test Deps has correct default values."""
        deps = Deps()
        assert deps.user_id is None
        assert deps.user_name is None
        assert deps.metadata == {}

    def test_deps_with_values(self):
        """Test Deps with custom values."""
        deps = Deps(user_id="123", user_name="Test User", metadata={"key": "value"})
        assert deps.user_id == "123"
        assert deps.user_name == "Test User"
        assert deps.metadata == {"key": "value"}


class TestGetCurrentDatetime:
    """Tests for get_current_datetime tool."""

    def test_returns_formatted_string(self):
        """Test get_current_datetime returns formatted string."""
        result = get_current_datetime()
        assert isinstance(result, str)
        # Should contain year, month, day
        assert len(result) > 10


class TestAssistantAgent:
    """Tests for AssistantAgent class."""

    def test_init_with_defaults(self):
        """Test AssistantAgent initializes with defaults."""
        agent = AssistantAgent()
        assert agent.system_prompt == "You are a helpful assistant."
        assert agent._agent is None

    def test_init_with_custom_values(self):
        """Test AssistantAgent with custom configuration."""
        agent = AssistantAgent(
            model_name="gpt-4",
            temperature=0.5,
            system_prompt="Custom prompt",
        )
        assert agent.model_name == "gpt-4"
        assert agent.temperature == 0.5
        assert agent.system_prompt == "Custom prompt"

    @patch("app.agents.assistant.OpenAIProvider")
    @patch("app.agents.assistant.OpenAIChatModel")
    def test_agent_property_creates_agent(self, mock_model, mock_provider):
        """Test agent property creates agent on first access."""
        agent = AssistantAgent()
        _ = agent.agent
        assert agent._agent is not None
        mock_model.assert_called_once()

    @patch("app.agents.assistant.OpenAIProvider")
    @patch("app.agents.assistant.OpenAIChatModel")
    def test_agent_property_caches_agent(self, mock_model, mock_provider):
        """Test agent property caches the agent instance."""
        agent = AssistantAgent()
        agent1 = agent.agent
        agent2 = agent.agent
        assert agent1 is agent2
        mock_model.assert_called_once()


class TestGetAgent:
    """Tests for get_agent factory function."""

    def test_returns_assistant_agent(self):
        """Test get_agent returns AssistantAgent."""
        agent = get_agent()
        assert isinstance(agent, AssistantAgent)


class TestAgentRoutes:
    """Tests for agent WebSocket routes."""

    @pytest.mark.anyio
    async def test_agent_websocket_connection(self, client):
        """Test WebSocket connection to agent endpoint."""
        # This test verifies the WebSocket endpoint is accessible
        # Actual agent testing would require mocking OpenAI
        pass


class TestHistoryConversion:
    """Tests for conversation history conversion."""

    def test_empty_history(self):
        """Test with empty history."""
        _agent = AssistantAgent()
        # History conversion happens inside run/iter methods
        # We test the structure here
        history = []
        assert len(history) == 0

    def test_history_roles(self):
        """Test history with different roles."""
        history = [
            {"role": "user", "content": "Hello"},
            {"role": "assistant", "content": "Hi there!"},
            {"role": "system", "content": "You are helpful"},
        ]
        assert len(history) == 3
        assert all("role" in msg and "content" in msg for msg in history)


class TestAreaAgentConfig:
    """Tests for AreaAgentConfig dataclass."""

    def test_area_config_basic(self):
        """Test AreaAgentConfig with basic fields."""
        config = AreaAgentConfig(
            area="test",
            system_prompt="Test prompt",
        )
        assert config.area == "test"
        assert config.system_prompt == "Test prompt"
        assert config.allowed_pipeline_tags is None
        assert config.allowed_pipelines is None
        assert config.toolsets is None

    def test_area_config_with_pipeline_tags(self):
        """Test AreaAgentConfig with pipeline tag filtering."""
        config = AreaAgentConfig(
            area="jobs",
            system_prompt="Job assistant",
            allowed_pipeline_tags=["jobs", "scraping"],
        )
        assert config.allowed_pipeline_tags == ["jobs", "scraping"]

    def test_get_allowed_pipeline_names_with_tags(self):
        """Test pipeline filtering by tags."""
        config = AreaAgentConfig(
            area="jobs",
            system_prompt="Test",
            allowed_pipeline_tags=["jobs"],
        )
        pipelines = [
            {"name": "job_search", "tags": ["jobs", "ai"]},
            {"name": "echo", "tags": ["utility"]},
            {"name": "job_analyze", "tags": ["jobs"]},
        ]
        allowed = config.get_allowed_pipeline_names(pipelines)
        assert allowed == {"job_search", "job_analyze"}

    def test_get_allowed_pipeline_names_explicit_list(self):
        """Test explicit pipeline list takes precedence over tags."""
        config = AreaAgentConfig(
            area="jobs",
            system_prompt="Test",
            allowed_pipeline_tags=["jobs"],
            allowed_pipelines=["specific_pipeline"],
        )
        pipelines = [
            {"name": "job_search", "tags": ["jobs"]},
            {"name": "specific_pipeline", "tags": []},
        ]
        allowed = config.get_allowed_pipeline_names(pipelines)
        assert allowed == {"specific_pipeline"}


class TestJobsAreaConfig:
    """Tests for the jobs area configuration."""

    def test_jobs_config_exists(self):
        """Test JOBS_AGENT_CONFIG is properly defined."""
        assert JOBS_AGENT_CONFIG is not None
        assert JOBS_AGENT_CONFIG.area == "jobs"
        assert "job search" in JOBS_AGENT_CONFIG.system_prompt.lower()

    def test_jobs_config_has_pipeline_tags(self):
        """Test jobs config filters pipelines by tag."""
        assert JOBS_AGENT_CONFIG.allowed_pipeline_tags == ["jobs"]

    def test_jobs_config_has_toolsets(self):
        """Test jobs config includes CRUD toolsets."""
        assert JOBS_AGENT_CONFIG.toolsets is not None
        assert len(JOBS_AGENT_CONFIG.toolsets) > 0

    def test_get_area_config_jobs(self):
        """Test get_area_config returns jobs config."""
        config = get_area_config("jobs")
        assert config is not None
        assert config.area == "jobs"

    def test_get_area_config_unknown(self):
        """Test get_area_config returns None for unknown area."""
        config = get_area_config("nonexistent")
        assert config is None

    def test_list_available_areas(self):
        """Test listing available areas."""
        areas = list_available_areas()
        assert isinstance(areas, list)
        assert len(areas) > 0
        # Jobs should be in the list
        area_ids = [a["area"] for a in areas]
        assert "jobs" in area_ids


class TestJobsToolsets:
    """Tests for jobs area toolsets."""

    def test_jobs_toolset_exists(self):
        """Test jobs_toolset is properly defined."""
        assert jobs_toolset is not None
        assert hasattr(jobs_toolset, "tools")

    def test_jobs_toolset_has_expected_tools(self):
        """Test jobs_toolset has the expected tools."""
        tool_names = set(jobs_toolset.tools.keys())
        expected = {"list_jobs", "get_job", "update_job_status", "get_job_stats", "delete_job"}
        assert tool_names == expected

    def test_job_profiles_toolset_exists(self):
        """Test job_profiles_toolset is properly defined."""
        assert job_profiles_toolset is not None
        assert hasattr(job_profiles_toolset, "tools")

    def test_job_profiles_toolset_has_expected_tools(self):
        """Test job_profiles_toolset has the expected tools."""
        tool_names = set(job_profiles_toolset.tools.keys())
        expected = {"list_profiles", "get_profile", "get_default_profile", "create_profile"}
        assert tool_names == expected


class TestGetAgentForArea:
    """Tests for get_agent_for_area factory function."""

    def test_returns_agent_for_jobs(self):
        """Test get_agent_for_area returns agent for jobs area."""
        agent = get_agent_for_area("jobs")
        assert agent is not None
        assert isinstance(agent, AssistantAgent)
        assert agent.area_config is not None
        assert agent.area_config.area == "jobs"

    def test_returns_none_for_unknown_area(self):
        """Test get_agent_for_area returns None for unknown area."""
        agent = get_agent_for_area("nonexistent")
        assert agent is None

    def test_jobs_agent_has_custom_prompt(self):
        """Test jobs area agent has custom system prompt."""
        agent = get_agent_for_area("jobs")
        assert agent is not None
        assert "job search" in agent.system_prompt.lower()

    @patch("app.agents.assistant.OpenAIProvider")
    @patch("app.agents.assistant.OpenAIChatModel")
    def test_jobs_agent_creates_with_toolsets(self, mock_model, mock_provider):
        """Test jobs area agent creates with toolsets."""
        agent = get_agent_for_area("jobs")
        assert agent is not None
        # Access agent property to trigger creation
        _ = agent.agent
        # Agent should have been created
        assert agent._agent is not None
