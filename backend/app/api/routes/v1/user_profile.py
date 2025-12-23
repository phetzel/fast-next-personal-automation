"""UserProfile API routes.

Provides REST endpoints for managing user profile with resume and job preferences.
"""

import logging

from fastapi import APIRouter

from app.api.deps import CurrentUser, UserProfileSvc
from app.schemas.user_profile import (
    UserProfileCreate,
    UserProfileResponse,
    UserProfileSummary,
    UserProfileUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("", response_model=UserProfileResponse | None)
async def get_profile(
    current_user: CurrentUser,
    profile_service: UserProfileSvc,
) -> UserProfileResponse | None:
    """Get current user's profile.

    Returns the user's resume text, target roles, locations, and preferences.
    Returns null if no profile exists yet.
    """
    profile = await profile_service.get_or_none(current_user.id)
    if profile is None:
        return None
    return UserProfileResponse.model_validate(profile)


@router.get("/summary", response_model=UserProfileSummary)
async def get_profile_summary(
    current_user: CurrentUser,
    profile_service: UserProfileSvc,
) -> UserProfileSummary:
    """Get a summary of the user's profile status.

    Useful for checking if the user has set up their profile before
    running the job search pipeline.
    """
    profile = await profile_service.get_or_none(current_user.id)
    if profile is None:
        return UserProfileSummary(has_profile=False)

    return UserProfileSummary(
        has_profile=True,
        has_resume=bool(profile.resume_text and profile.resume_text.strip()),
        target_roles_count=len(profile.target_roles or []),
        min_score_threshold=profile.min_score_threshold,
    )


@router.put("", response_model=UserProfileResponse)
async def upsert_profile(
    profile_in: UserProfileCreate,
    current_user: CurrentUser,
    profile_service: UserProfileSvc,
) -> UserProfileResponse:
    """Create or update user's profile.

    Use this endpoint to set up or update the user's resume and job
    search preferences. The profile is used by the job search pipeline
    to score job relevance.
    """
    profile = await profile_service.upsert(current_user.id, profile_in)
    return UserProfileResponse.model_validate(profile)


@router.patch("", response_model=UserProfileResponse)
async def update_profile(
    profile_in: UserProfileUpdate,
    current_user: CurrentUser,
    profile_service: UserProfileSvc,
) -> UserProfileResponse:
    """Partially update user's profile.

    Update only the fields that are provided. Useful for updating
    just the resume or just the preferences without affecting other fields.
    """
    profile = await profile_service.update(current_user.id, profile_in)
    return UserProfileResponse.model_validate(profile)


@router.delete("", response_model=UserProfileResponse)
async def delete_profile(
    current_user: CurrentUser,
    profile_service: UserProfileSvc,
) -> UserProfileResponse:
    """Delete user's profile.

    Removes the user's resume and preferences. Jobs are not deleted.
    """
    profile = await profile_service.delete(current_user.id)
    return UserProfileResponse.model_validate(profile)

