"""JobProfile repository (PostgreSQL async).

Contains database operations for JobProfile entity. Business logic
should be handled by JobProfileService in app/services/job_profile.py.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_profile import JobProfile


async def get_by_id(db: AsyncSession, profile_id: UUID) -> JobProfile | None:
    """Get job profile by ID."""
    return await db.get(JobProfile, profile_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[JobProfile]:
    """Get all job profiles for a user."""
    result = await db.execute(
        select(JobProfile)
        .where(JobProfile.user_id == user_id)
        .order_by(JobProfile.is_default.desc(), JobProfile.created_at)
    )
    return list(result.scalars().all())


async def get_by_user_and_name(db: AsyncSession, user_id: UUID, name: str) -> JobProfile | None:
    """Get a profile by user ID and name."""
    result = await db.execute(
        select(JobProfile).where(
            and_(
                JobProfile.user_id == user_id,
                JobProfile.name == name,
            )
        )
    )
    return result.scalar_one_or_none()


async def get_default_for_user(db: AsyncSession, user_id: UUID) -> JobProfile | None:
    """Get the default profile for a user."""
    result = await db.execute(
        select(JobProfile).where(
            and_(
                JobProfile.user_id == user_id,
                JobProfile.is_default == True,  # noqa: E712
            )
        )
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    name: str = "Default Profile",
    is_default: bool = False,
    resume_id: UUID | None = None,
    target_roles: list[str] | None = None,
    target_locations: list[str] | None = None,
    min_score_threshold: float = 7.0,
    preferences: dict[str, Any] | None = None,
) -> JobProfile:
    """Create a new job profile."""
    profile = JobProfile(
        user_id=user_id,
        name=name,
        is_default=is_default,
        resume_id=resume_id,
        target_roles=target_roles or [],
        target_locations=target_locations or [],
        min_score_threshold=min_score_threshold,
        preferences=preferences or {},
    )
    db.add(profile)
    await db.flush()
    await db.refresh(profile)
    return profile


async def update(
    db: AsyncSession,
    *,
    db_profile: JobProfile,
    update_data: dict,
) -> JobProfile:
    """Update a job profile."""
    for field, value in update_data.items():
        setattr(db_profile, field, value)

    db.add(db_profile)
    await db.flush()
    await db.refresh(db_profile)
    return db_profile


async def set_default(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
) -> JobProfile | None:
    """Set a profile as the default, unsetting any other default.

    Returns the updated profile, or None if not found.
    """
    # First, unset all defaults for this user
    profiles = await get_by_user_id(db, user_id)
    for profile in profiles:
        if profile.is_default and profile.id != profile_id:
            profile.is_default = False
            db.add(profile)

    # Set the new default
    target_profile = await get_by_id(db, profile_id)
    if target_profile and target_profile.user_id == user_id:
        target_profile.is_default = True
        db.add(target_profile)
        await db.flush()
        await db.refresh(target_profile)
        return target_profile

    return None


async def delete(db: AsyncSession, profile_id: UUID) -> JobProfile | None:
    """Delete a job profile by ID."""
    profile = await get_by_id(db, profile_id)
    if profile:
        await db.delete(profile)
        await db.flush()
    return profile


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all profiles for a user. Returns count of deleted profiles."""
    profiles = await get_by_user_id(db, user_id)
    count = len(profiles)
    for profile in profiles:
        await db.delete(profile)
    await db.flush()
    return count
