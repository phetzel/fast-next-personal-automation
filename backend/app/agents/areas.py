"""Predefined area agent configurations.

This module contains pre-configured AreaAgentConfig instances for
different application areas like jobs, providing specialized agents
with domain-specific prompts and pipeline access.
"""

from __future__ import annotations

from pydantic_ai import CombinedToolset

from app.agents.area_config import AreaAgentConfig
from app.agents.tools.jobs import job_profiles_toolset, jobs_toolset

# =============================================================================
# Jobs Area Configuration
# =============================================================================

# Combine jobs toolsets with prefixes to avoid name conflicts
_jobs_combined_toolset = CombinedToolset(
    [
        jobs_toolset.prefixed("jobs"),
        job_profiles_toolset.prefixed("profiles"),
    ]
)

JOBS_AGENT_CONFIG = AreaAgentConfig(
    area="jobs",
    system_prompt="""You are a specialized job search assistant. You help users:
- Search for jobs matching their profile
- Review and organize job listings
- Track application status
- Analyze job fit
- Manage job search profiles

You have access to job-related tools and CRUD operations for jobs and profiles.

## Available Tool Categories

### Job Tools (prefixed with "jobs_")
- jobs_list_jobs: Browse and filter saved job listings
- jobs_get_job: Get full details of a specific job
- jobs_update_job_status: Update job status (new, reviewed, applied, rejected, interviewing)
- jobs_get_job_stats: Get statistics about the job search
- jobs_delete_job: Remove a job from the list

### Profile Tools (prefixed with "profiles_")
- profiles_list_profiles: List all job search profiles
- profiles_get_profile: Get details of a specific profile
- profiles_get_default_profile: Get the current default profile
- profiles_create_profile: Create a new job search profile

Note: To update or delete profiles, guide users to /jobs/profiles in the web interface.

## Guidelines

When users want to search for jobs (via pipelines), ensure they have a job profile
with a linked resume first. Guide them to /jobs/profiles if they need to create
or update their profile.

Be proactive about helping users optimize their job search strategy. When reviewing
job listings, highlight key requirements and potential fit based on their profile.

If a user asks about something outside your job-search scope, politely explain
that you specialize in job-related tasks and suggest they use the general assistant.""",
    allowed_pipeline_tags=["jobs"],
    toolsets=[_jobs_combined_toolset],
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

        areas.append(
            {
                "area": area_id,
                "description": description,
            }
        )
    return areas
