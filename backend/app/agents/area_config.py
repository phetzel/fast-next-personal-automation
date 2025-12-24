"""Area-specific agent configuration.

This module defines the configuration structure for area-scoped agents,
allowing different areas (like "jobs") to have customized agent behavior
with filtered pipelines and custom system prompts.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from pydantic_ai.toolsets import AbstractToolset


@dataclass
class AreaAgentConfig:
    """Configuration for an area-specific agent.

    Area agents have access to a subset of pipelines and use custom
    system prompts tailored to their domain.

    Attributes:
        area: The area identifier (e.g., "jobs").
        system_prompt: Custom system prompt for this area's agent.
        allowed_pipeline_tags: If set, only pipelines with these tags are accessible.
        allowed_pipelines: If set, only these specific pipelines are accessible.
            Takes precedence over tags if both are set.
        toolsets: Optional list of FunctionToolsets to register with the agent.
            These provide CRUD operations and other area-specific functionality.
        additional_tools: Optional list of additional tool functions to register.
            Deprecated: prefer using toolsets instead.
    """

    area: str
    system_prompt: str
    allowed_pipeline_tags: list[str] | None = None
    allowed_pipelines: list[str] | None = None
    toolsets: list["AbstractToolset"] | None = field(default_factory=lambda: None)
    additional_tools: list[Callable] | None = field(default_factory=lambda: None)

    def get_allowed_pipeline_names(self, all_pipelines: list[dict]) -> set[str]:
        """Get the set of pipeline names this area config allows.

        Args:
            all_pipelines: List of all pipeline info dicts with 'name', 'tags', 'area'.

        Returns:
            Set of allowed pipeline names.
        """
        # If explicit list is provided, use that
        if self.allowed_pipelines is not None:
            return set(self.allowed_pipelines)

        # If tags are provided, filter by tags
        if self.allowed_pipeline_tags is not None:
            allowed = set()
            for pipeline in all_pipelines:
                pipeline_tags = pipeline.get("tags", [])
                # Pipeline must have at least one of the allowed tags
                if any(tag in pipeline_tags for tag in self.allowed_pipeline_tags):
                    allowed.add(pipeline["name"])
            return allowed

        # No restrictions - return all pipeline names
        return {p["name"] for p in all_pipelines}

