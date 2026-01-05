"""JobProfile repository (PostgreSQL async).

Contains database operations for JobProfile entity. Business logic
should be handled by JobProfileService in app/services/job_profile.py.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.job_profile import JobProfile
from app.repositories.base import PrimaryEntityRepository
from app.schemas.job_profile import JobProfileCreate, JobProfileUpdate


class JobProfileRepository(PrimaryEntityRepository[JobProfile, JobProfileCreate, JobProfileUpdate]):
    """Repository for JobProfile entity operations."""

    primary_field = "is_default"  # Override from is_primary

    def __init__(self):
        super().__init__(JobProfile)

    async def get_by_user_id(self, db: AsyncSession, user_id: UUID) -> list[JobProfile]:
        """Get all job profiles for a user."""
        return await self.get_by_user_ordered(db, user_id)

    async def get_by_user_and_name(
        self, db: AsyncSession, user_id: UUID, name: str
    ) -> JobProfile | None:
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

    async def get_default_for_user(self, db: AsyncSession, user_id: UUID) -> JobProfile | None:
        """Get the default profile for a user."""
        return await self.get_primary_for_user(db, user_id)

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        name: str = "Default Profile",
        is_default: bool = False,
        resume_id: UUID | None = None,
        story_id: UUID | None = None,
        project_ids: list[str] | None = None,
        target_roles: list[str] | None = None,
        target_locations: list[str] | None = None,
        min_score_threshold: float = 7.0,
        preferences: dict[str, Any] | None = None,
        contact_full_name: str | None = None,
        contact_email: str | None = None,
        contact_phone: str | None = None,
        contact_location: str | None = None,
        contact_website: str | None = None,
    ) -> JobProfile:
        """Create a new job profile."""
        return await self.create_with_kwargs(
            db,
            user_id=user_id,
            name=name,
            is_default=is_default,
            resume_id=resume_id,
            story_id=story_id,
            project_ids=project_ids or [],
            target_roles=target_roles or [],
            target_locations=target_locations or [],
            min_score_threshold=min_score_threshold,
            preferences=preferences or {},
            contact_full_name=contact_full_name,
            contact_email=contact_email,
            contact_phone=contact_phone,
            contact_location=contact_location,
            contact_website=contact_website,
        )

    async def update(
        self,
        db: AsyncSession,
        *,
        db_profile: JobProfile,
        update_data: dict,
    ) -> JobProfile:
        """Update a job profile."""
        return await super().update(db, db_obj=db_profile, obj_in=update_data)

    async def set_default(
        self,
        db: AsyncSession,
        user_id: UUID,
        profile_id: UUID,
    ) -> JobProfile | None:
        """Set a profile as the default, unsetting any other default."""
        return await self.set_primary(db, user_id, profile_id)

    async def delete(self, db: AsyncSession, profile_id: UUID) -> JobProfile | None:
        """Delete a job profile by ID."""
        return await super().delete(db, id=profile_id)

    async def delete_by_user_id(self, db: AsyncSession, user_id: UUID) -> int:
        """Delete all profiles for a user. Returns count of deleted profiles."""
        return await self.delete_by_user(db, user_id)


# Module-level singleton for backward compatibility
_repository = JobProfileRepository()


# Expose module-level functions for backward compatibility
async def get_by_id(db: AsyncSession, profile_id: UUID) -> JobProfile | None:
    """Get job profile by ID."""
    return await _repository.get(db, profile_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[JobProfile]:
    """Get all job profiles for a user."""
    return await _repository.get_by_user_id(db, user_id)


async def get_by_user_and_name(db: AsyncSession, user_id: UUID, name: str) -> JobProfile | None:
    """Get a profile by user ID and name."""
    return await _repository.get_by_user_and_name(db, user_id, name)


async def get_default_for_user(db: AsyncSession, user_id: UUID) -> JobProfile | None:
    """Get the default profile for a user."""
    return await _repository.get_default_for_user(db, user_id)


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    name: str = "Default Profile",
    is_default: bool = False,
    resume_id: UUID | None = None,
    story_id: UUID | None = None,
    project_ids: list[str] | None = None,
    target_roles: list[str] | None = None,
    target_locations: list[str] | None = None,
    min_score_threshold: float = 7.0,
    preferences: dict[str, Any] | None = None,
    contact_full_name: str | None = None,
    contact_email: str | None = None,
    contact_phone: str | None = None,
    contact_location: str | None = None,
    contact_website: str | None = None,
) -> JobProfile:
    """Create a new job profile."""
    return await _repository.create(
        db,
        user_id=user_id,
        name=name,
        is_default=is_default,
        resume_id=resume_id,
        story_id=story_id,
        project_ids=project_ids,
        target_roles=target_roles,
        target_locations=target_locations,
        min_score_threshold=min_score_threshold,
        preferences=preferences,
        contact_full_name=contact_full_name,
        contact_email=contact_email,
        contact_phone=contact_phone,
        contact_location=contact_location,
        contact_website=contact_website,
    )


async def update(
    db: AsyncSession,
    *,
    db_profile: JobProfile,
    update_data: dict,
) -> JobProfile:
    """Update a job profile."""
    return await _repository.update(db, db_profile=db_profile, update_data=update_data)


async def set_default(
    db: AsyncSession,
    user_id: UUID,
    profile_id: UUID,
) -> JobProfile | None:
    """Set a profile as the default, unsetting any other default."""
    return await _repository.set_default(db, user_id, profile_id)


async def delete(db: AsyncSession, profile_id: UUID) -> JobProfile | None:
    """Delete a job profile by ID."""
    return await _repository.delete(db, profile_id)


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all profiles for a user. Returns count of deleted profiles."""
    return await _repository.delete_by_user_id(db, user_id)
