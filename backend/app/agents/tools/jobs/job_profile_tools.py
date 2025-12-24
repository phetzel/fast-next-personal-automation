"""Job Profile tools for the Jobs area agent.

This module provides FunctionToolset tools for viewing and creating job search
profiles through the AI assistant. For updates and deletions, users should
use the web interface at /jobs/profiles.
"""

from typing import Any
from uuid import UUID

from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from app.repositories import job_profile as profile_repo
from app.schemas.job_profile import JobProfileResponse, JobProfileSummary


def _get_db_and_user(ctx: RunContext) -> tuple:
    """Extract db session and user_id from context, with validation."""
    if not ctx.deps.db:
        return None, None, "Database session not available"
    if not ctx.deps.user_id:
        return None, None, "User not authenticated"
    try:
        user_id = UUID(ctx.deps.user_id)
    except ValueError:
        return None, None, "Invalid user ID"
    return ctx.deps.db, user_id, None


def _profile_to_summary(profile) -> dict:
    """Convert a JobProfile model to a summary dict."""
    return JobProfileSummary(
        id=profile.id,
        name=profile.name,
        is_default=profile.is_default,
        has_resume=profile.resume_id is not None,
        resume_name=profile.resume.name if profile.resume else None,
        target_roles_count=len(profile.target_roles) if profile.target_roles else 0,
        min_score_threshold=profile.min_score_threshold,
    ).model_dump(mode="json")


# Create the toolset
job_profiles_toolset = FunctionToolset()


@job_profiles_toolset.tool
async def list_profiles(ctx: RunContext) -> dict:
    """List all job search profiles for the current user.

    Profiles contain settings like target roles, locations, and linked resumes
    that are used when searching for and scoring jobs.

    Returns:
        List of profile summaries with basic info
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    profiles = await profile_repo.get_by_user_id(db, user_id)

    return {
        "success": True,
        "profiles": [_profile_to_summary(p) for p in profiles],
        "count": len(profiles),
    }


@job_profiles_toolset.tool
async def get_profile(ctx: RunContext, profile_id: str) -> dict:
    """Get detailed information about a specific job search profile.

    Args:
        profile_id: The UUID of the profile to retrieve

    Returns:
        Full profile details including target roles, locations, and preferences
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    try:
        profile_uuid = UUID(profile_id)
    except ValueError:
        return {"success": False, "error": f"Invalid profile ID format: {profile_id}"}

    profile = await profile_repo.get_by_id(db, profile_uuid)
    if not profile or profile.user_id != user_id:
        return {"success": False, "error": f"Profile not found with ID: {profile_id}"}

    return {
        "success": True,
        "profile": JobProfileResponse.model_validate(profile).model_dump(mode="json"),
    }


@job_profiles_toolset.tool
async def get_default_profile(ctx: RunContext) -> dict:
    """Get the user's default job search profile.

    The default profile is used automatically when running job searches
    without specifying a profile ID.

    Returns:
        Default profile details or message if none is set
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    profile = await profile_repo.get_default_for_user(db, user_id)
    if not profile:
        return {
            "success": True,
            "profile": None,
            "message": "No default profile is set. Create a profile or set one as default.",
        }

    return {
        "success": True,
        "profile": JobProfileResponse.model_validate(profile).model_dump(mode="json"),
    }


@job_profiles_toolset.tool
async def create_profile(
    ctx: RunContext,
    name: str,
    target_roles: list[str] | None = None,
    target_locations: list[str] | None = None,
    min_score_threshold: float = 7.0,
    is_default: bool = False,
    preferences: dict[str, Any] | None = None,
) -> dict:
    """Create a new job search profile.

    Profiles define your job search criteria including target roles,
    preferred locations, and scoring thresholds.

    Args:
        name: A descriptive name for this profile (e.g., "Backend Remote Jobs")
        target_roles: List of job titles to target (e.g., ["Python Developer", "Backend Engineer"])
        target_locations: List of preferred locations (e.g., ["Remote", "San Francisco, CA"])
        min_score_threshold: Minimum relevance score (0-10) for jobs to save. Default 7.0
        is_default: Whether to make this the default profile
        preferences: Additional preferences like remote_only, salary_min, etc.

    Returns:
        Created profile details
    """
    db, user_id, error = _get_db_and_user(ctx)
    if error:
        return {"success": False, "error": error}

    # Check if name already exists for this user
    existing = await profile_repo.get_by_user_and_name(db, user_id, name)
    if existing:
        return {
            "success": False,
            "error": f"A profile named '{name}' already exists. Please choose a different name.",
        }

    # Validate min_score_threshold
    if min_score_threshold < 0 or min_score_threshold > 10:
        return {
            "success": False,
            "error": "min_score_threshold must be between 0 and 10",
        }

    profile = await profile_repo.create(
        db,
        user_id=user_id,
        name=name,
        is_default=is_default,
        target_roles=target_roles,
        target_locations=target_locations,
        min_score_threshold=min_score_threshold,
        preferences=preferences,
    )

    # If this is set as default, unset other defaults
    if is_default:
        await profile_repo.set_default(db, user_id, profile.id)

    return {
        "success": True,
        "message": f"Created profile '{name}'",
        "profile": _profile_to_summary(profile),
    }
