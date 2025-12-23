"""UserProfile service (PostgreSQL async).

Contains business logic for user profile operations.
Uses user_profile repository for database access.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.user_profile import UserProfile
from app.repositories import user_profile_repo
from app.schemas.user_profile import UserProfileCreate, UserProfileUpdate


class UserProfileService:
    """Service for user profile business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_user_id(self, user_id: UUID) -> UserProfile:
        """Get profile by user ID.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await user_profile_repo.get_by_user_id(self.db, user_id)
        if not profile:
            raise NotFoundError(
                message="Profile not found",
                details={"user_id": str(user_id)},
            )
        return profile

    async def get_or_none(self, user_id: UUID) -> UserProfile | None:
        """Get profile by user ID, or None if not found."""
        return await user_profile_repo.get_by_user_id(self.db, user_id)

    async def create(
        self,
        user_id: UUID,
        profile_in: UserProfileCreate,
    ) -> UserProfile:
        """Create a new user profile."""
        return await user_profile_repo.create(
            self.db,
            user_id=user_id,
            resume_text=profile_in.resume_text,
            target_roles=profile_in.target_roles,
            target_locations=profile_in.target_locations,
            min_score_threshold=profile_in.min_score_threshold,
            preferences=profile_in.preferences,
        )

    async def update(
        self,
        user_id: UUID,
        profile_in: UserProfileUpdate,
    ) -> UserProfile:
        """Update user profile.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await self.get_by_user_id(user_id)
        update_data = profile_in.model_dump(exclude_unset=True)
        return await user_profile_repo.update(
            self.db, db_profile=profile, update_data=update_data
        )

    async def upsert(
        self,
        user_id: UUID,
        profile_in: UserProfileCreate | UserProfileUpdate,
    ) -> UserProfile:
        """Create or update user profile."""
        data = profile_in.model_dump(exclude_unset=True)
        return await user_profile_repo.upsert(self.db, user_id, data)

    async def delete(self, user_id: UUID) -> UserProfile:
        """Delete user profile.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await user_profile_repo.delete(self.db, user_id)
        if not profile:
            raise NotFoundError(
                message="Profile not found",
                details={"user_id": str(user_id)},
            )
        return profile

    async def has_resume(self, user_id: UUID) -> bool:
        """Check if user has a resume uploaded."""
        profile = await self.get_or_none(user_id)
        if not profile:
            return False
        return bool(profile.resume_text and profile.resume_text.strip())

    async def get_resume_text(self, user_id: UUID) -> str | None:
        """Get user's resume text for job analysis."""
        profile = await self.get_or_none(user_id)
        if not profile:
            return None
        return profile.resume_text

