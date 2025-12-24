"""Predefined area agent configurations.

This module contains pre-configured AreaAgentConfig instances for
different application areas like jobs, providing specialized agents
with domain-specific prompts and pipeline access.
"""

from __future__ import annotations

from app.agents.area_config import AreaAgentConfig

# =============================================================================
# Jobs Area Configuration
# =============================================================================

JOBS_AGENT_CONFIG = AreaAgentConfig(
    area="jobs",
    system_prompt="""You are a specialized job search assistant. You help users:
- Search for jobs matching their profile
- Review and organize job listings
- Track application status
- Analyze job fit

You have access to job-related tools only. When users want to search for jobs, 
ensure they have a job profile with a linked resume first. Guide them to 
/jobs/profiles if they need to create or update their profile.

Be proactive about helping users optimize their job search strategy. When reviewing
job listings, highlight key requirements and potential fit based on their profile.
If a user asks about something outside your job-search scope, politely explain 
that you specialize in job-related tasks and suggest they use the general assistant.""",
    allowed_pipeline_tags=["jobs"],
)


# =============================================================================
# Area Registry
# =============================================================================

# Map of area identifiers to their configurations
AREA_CONFIGS: dict[str, AreaAgentConfig] = {
    "jobs": JOBS_AGENT_CONFIG,
}


def get_area_config(area: str) -> AreaAgentConfig | None:
    """Get the configuration for a specific area.

    Args:
        area: The area identifier (e.g., "jobs").

    Returns:
        AreaAgentConfig if the area exists, None otherwise.
    """
    return AREA_CONFIGS.get(area)


def list_available_areas() -> list[dict]:
    """List all available area configurations.

    Returns:
        List of dicts with area info (area, description extracted from prompt).
    """
    areas = []
    for area_id, config in AREA_CONFIGS.items():
        # Extract first line of system prompt as description
        first_line = config.system_prompt.strip().split("\n")[0]
        # Remove "You are a" prefix if present
        description = first_line.replace("You are a ", "").replace("You are an ", "")

        areas.append({
            "area": area_id,
            "description": description,
        })
    return areas

