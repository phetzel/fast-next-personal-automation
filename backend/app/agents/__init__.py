"""AI Agents module using PydanticAI.

This module contains agents that handle AI-powered interactions.
Tools are defined in the tools/ subdirectory.
"""

from app.agents.area_config import AreaAgentConfig
from app.agents.areas import AREA_CONFIGS, JOBS_AGENT_CONFIG, get_area_config, list_available_areas
from app.agents.assistant import AssistantAgent, Deps, get_agent, get_agent_for_area

__all__ = [
    "AREA_CONFIGS",
    "JOBS_AGENT_CONFIG",
    "AreaAgentConfig",
    "AssistantAgent",
    "Deps",
    "get_agent",
    "get_agent_for_area",
    "get_area_config",
    "list_available_areas",
]
