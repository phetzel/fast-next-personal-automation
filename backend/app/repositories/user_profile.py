"""UserProfile repository (PostgreSQL async).

Contains database operations for UserProfile entity. Business logic
should be handled by UserProfileService in app/services/user_profile.py.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user_profile import UserProfile


async def get_by_id(db: AsyncSession, profile_id: UUID) -> UserProfile | None:
    """Get user profile by ID."""
    return await db.get(UserProfile, profile_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> UserProfile | None:
    """Get user profile by user ID."""
    result = await db.execute(
        select(UserProfile).where(UserProfile.user_id == user_id)
    )
    return result.scalar_one_or_none()


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    resume_text: str | None = None,
    target_roles: list[str] | None = None,
    target_locations: list[str] | None = None,
    min_score_threshold: float = 7.0,
    preferences: dict[str, Any] | None = None,
) -> UserProfile:
    """Create a new user profile."""
    profile = UserProfile(
        user_id=user_id,
        resume_text=resume_text,
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
    db_profile: UserProfile,
    update_data: dict,
) -> UserProfile:
    """Update a user profile."""
    for field, value in update_data.items():
        setattr(db_profile, field, value)

    db.add(db_profile)
    await db.flush()
    await db.refresh(db_profile)
    return db_profile


async def upsert(
    db: AsyncSession,
    user_id: UUID,
    data: dict,
) -> UserProfile:
    """Create or update a user profile.

    If a profile exists for the user, update it.
    Otherwise, create a new one.
    """
    existing = await get_by_user_id(db, user_id)

    if existing:
        return await update(db, db_profile=existing, update_data=data)
    else:
        return await create(db, user_id=user_id, **data)


async def delete(db: AsyncSession, user_id: UUID) -> UserProfile | None:
    """Delete a user profile."""
    profile = await get_by_user_id(db, user_id)
    if profile:
        await db.delete(profile)
        await db.flush()
    return profile

