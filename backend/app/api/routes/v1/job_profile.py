"""JobProfile API routes.

Provides REST endpoints for managing job profiles with resume and preferences.
Supports multiple profiles per user with default selection.
"""

import logging
from uuid import UUID

from fastapi import APIRouter

from app.api.deps import CurrentUser, JobProfileSvc
from app.db.models.job_profile import JobProfile
from app.schemas.job_profile import (
    JobProfileCreate,
    JobProfileResponse,
    JobProfileSummary,
    JobProfileUpdate,
    ResumeInfo,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _profile_to_response(profile: JobProfile) -> JobProfileResponse:
    """Convert a JobProfile model to a response schema with resume info."""
    resume_info = None
    if profile.resume:
        resume_info = ResumeInfo(
            id=profile.resume.id,
            name=profile.resume.name,
            original_filename=profile.resume.original_filename,
            has_text=bool(profile.resume.text_content),
        )

    return JobProfileResponse(
        id=profile.id,
        user_id=profile.user_id,
        name=profile.name,
        is_default=profile.is_default,
        resume_id=profile.resume_id,
        resume=resume_info,
        target_roles=profile.target_roles,
        target_locations=profile.target_locations,
        min_score_threshold=profile.min_score_threshold,
        preferences=profile.preferences,
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("", response_model=list[JobProfileSummary])
async def list_profiles(
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> list[JobProfileSummary]:
    """List all job profiles for the current user.

    Returns profiles ordered by default status (default first) then creation date.
    """
    profiles = await profile_service.list_for_user(current_user.id)
    return [
        JobProfileSummary(
            id=p.id,
            name=p.name,
            is_default=p.is_default,
            has_resume=bool(p.resume and p.resume.text_content),
            resume_name=p.resume.name if p.resume else None,
            target_roles_count=len(p.target_roles or []),
            min_score_threshold=p.min_score_threshold,
        )
        for p in profiles
    ]


@router.get("/default", response_model=JobProfileResponse | None)
async def get_default_profile(
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> JobProfileResponse | None:
    """Get the user's default job profile.

    Returns null if no profiles exist.
    """
    profile = await profile_service.get_default_for_user(current_user.id)
    if profile is None:
        return None
    return _profile_to_response(profile)


@router.get("/{profile_id}", response_model=JobProfileResponse)
async def get_profile(
    profile_id: UUID,
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> JobProfileResponse:
    """Get a specific job profile by ID.

    Only returns profiles belonging to the current user.
    """
    profile = await profile_service.get_by_id(profile_id, current_user.id)
    return _profile_to_response(profile)


@router.post("", response_model=JobProfileResponse, status_code=201)
async def create_profile(
    profile_in: JobProfileCreate,
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> JobProfileResponse:
    """Create a new job profile.

    If this is the user's first profile, it will be automatically set as default.
    Profile names must be unique per user.
    """
    profile = await profile_service.create(current_user.id, profile_in)
    return _profile_to_response(profile)


@router.patch("/{profile_id}", response_model=JobProfileResponse)
async def update_profile(
    profile_id: UUID,
    profile_in: JobProfileUpdate,
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> JobProfileResponse:
    """Update an existing job profile.

    All fields are optional - only provided fields will be updated.
    Profile names must remain unique per user.
    """
    profile = await profile_service.update(profile_id, current_user.id, profile_in)
    return _profile_to_response(profile)


@router.delete("/{profile_id}", response_model=JobProfileResponse)
async def delete_profile(
    profile_id: UUID,
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> JobProfileResponse:
    """Delete a job profile.

    If the deleted profile was the default, another profile will become default.
    """
    profile = await profile_service.delete(profile_id, current_user.id)
    return _profile_to_response(profile)


@router.post("/{profile_id}/set-default", response_model=JobProfileResponse)
async def set_default_profile(
    profile_id: UUID,
    current_user: CurrentUser,
    profile_service: JobProfileSvc,
) -> JobProfileResponse:
    """Set a profile as the default.

    Only one profile can be default at a time. Setting a new default
    will unset any previous default.
    """
    profile = await profile_service.set_default(current_user.id, profile_id)
    return _profile_to_response(profile)
