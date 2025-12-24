"""JobProfile service (PostgreSQL async).

Contains business logic for job profile operations.
Uses job_profile repository for database access.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.db.models.job_profile import JobProfile
from app.repositories import job_profile_repo, resume_repo
from app.schemas.job_profile import (
    JobProfileCreate,
    JobProfileUpdate,
)


class JobProfileService:
    """Service for job profile business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, profile_id: UUID, user_id: UUID) -> JobProfile:
        """Get profile by ID, ensuring it belongs to the user.

        Raises:
            NotFoundError: If profile does not exist or doesn't belong to user.
        """
        profile = await job_profile_repo.get_by_id(self.db, profile_id)
        if not profile or profile.user_id != user_id:
            raise NotFoundError(
                message="Profile not found",
                details={"profile_id": str(profile_id)},
            )
        return profile

    async def list_for_user(self, user_id: UUID) -> list[JobProfile]:
        """Get all profiles for a user, ordered by default status and creation date."""
        return await job_profile_repo.get_by_user_id(self.db, user_id)

    async def get_default_for_user(self, user_id: UUID) -> JobProfile | None:
        """Get the default profile for a user, or None if none exists."""
        return await job_profile_repo.get_default_for_user(self.db, user_id)

    async def get_or_create_default(self, user_id: UUID) -> JobProfile:
        """Get the default profile for a user, creating one if none exists."""
        profile = await job_profile_repo.get_default_for_user(self.db, user_id)
        if profile:
            return profile

        # Check if user has any profiles
        profiles = await job_profile_repo.get_by_user_id(self.db, user_id)
        if profiles:
            # Set first profile as default
            return await self.set_default(user_id, profiles[0].id)

        # Create a new default profile
        return await job_profile_repo.create(
            self.db,
            user_id=user_id,
            name="Default Profile",
            is_default=True,
        )

    async def create(
        self,
        user_id: UUID,
        profile_in: JobProfileCreate,
    ) -> JobProfile:
        """Create a new job profile.

        Raises:
            ValidationError: If a profile with the same name already exists.
            ValidationError: If resume_id is provided but doesn't belong to user.
        """
        # Check for duplicate name
        existing = await job_profile_repo.get_by_user_and_name(self.db, user_id, profile_in.name)
        if existing:
            raise ValidationError(
                message=f"A profile named '{profile_in.name}' already exists",
                details={"name": profile_in.name},
            )

        # Validate resume ownership if provided
        if profile_in.resume_id:
            resume = await resume_repo.get_by_id(self.db, profile_in.resume_id)
            if not resume or resume.user_id != user_id:
                raise ValidationError(
                    message="Resume not found or doesn't belong to you",
                    details={"resume_id": str(profile_in.resume_id)},
                )

        # If this is set as default, or it's the first profile, make it default
        is_default = profile_in.is_default
        if not is_default:
            existing_profiles = await job_profile_repo.get_by_user_id(self.db, user_id)
            if not existing_profiles:
                is_default = True

        profile = await job_profile_repo.create(
            self.db,
            user_id=user_id,
            name=profile_in.name,
            is_default=is_default,
            resume_id=profile_in.resume_id,
            target_roles=profile_in.target_roles,
            target_locations=profile_in.target_locations,
            min_score_threshold=profile_in.min_score_threshold,
            preferences=profile_in.preferences,
        )

        # If marked as default, unset other defaults
        if is_default:
            await self._ensure_single_default(user_id, profile.id)

        return profile

    async def update(
        self,
        profile_id: UUID,
        user_id: UUID,
        profile_in: JobProfileUpdate,
    ) -> JobProfile:
        """Update a job profile.

        Raises:
            NotFoundError: If profile does not exist.
            ValidationError: If new name conflicts with existing profile.
            ValidationError: If resume_id is provided but doesn't belong to user.
        """
        profile = await self.get_by_id(profile_id, user_id)
        update_data = profile_in.model_dump(exclude_unset=True)

        # Check for name conflict if name is being changed
        if "name" in update_data and update_data["name"] != profile.name:
            existing = await job_profile_repo.get_by_user_and_name(
                self.db, user_id, update_data["name"]
            )
            if existing:
                raise ValidationError(
                    message=f"A profile named '{update_data['name']}' already exists",
                    details={"name": update_data["name"]},
                )

        # Validate resume ownership if provided
        if update_data.get("resume_id"):
            resume = await resume_repo.get_by_id(self.db, update_data["resume_id"])
            if not resume or resume.user_id != user_id:
                raise ValidationError(
                    message="Resume not found or doesn't belong to you",
                    details={"resume_id": str(update_data["resume_id"])},
                )

        updated = await job_profile_repo.update(
            self.db, db_profile=profile, update_data=update_data
        )

        # If marked as default, unset other defaults
        if update_data.get("is_default"):
            await self._ensure_single_default(user_id, profile_id)

        return updated

    async def delete(self, profile_id: UUID, user_id: UUID) -> JobProfile:
        """Delete a job profile.

        If deleting the default profile, another profile will become default.

        Raises:
            NotFoundError: If profile does not exist.
        """
        profile = await self.get_by_id(profile_id, user_id)
        was_default = profile.is_default

        deleted = await job_profile_repo.delete(self.db, profile_id)
        if not deleted:
            raise NotFoundError(
                message="Profile not found",
                details={"profile_id": str(profile_id)},
            )

        # If we deleted the default, set another profile as default
        if was_default:
            remaining = await job_profile_repo.get_by_user_id(self.db, user_id)
            if remaining:
                await job_profile_repo.set_default(self.db, user_id, remaining[0].id)

        return deleted

    async def set_default(self, user_id: UUID, profile_id: UUID) -> JobProfile:
        """Set a profile as the default.

        Raises:
            NotFoundError: If profile does not exist or doesn't belong to user.
        """
        # Verify ownership
        await self.get_by_id(profile_id, user_id)

        result = await job_profile_repo.set_default(self.db, user_id, profile_id)
        if not result:
            raise NotFoundError(
                message="Profile not found",
                details={"profile_id": str(profile_id)},
            )
        return result

    async def has_resume(self, user_id: UUID, profile_id: UUID | None = None) -> bool:
        """Check if user has a resume linked to the specified or default profile."""
        if profile_id:
            profile = await job_profile_repo.get_by_id(self.db, profile_id)
        else:
            profile = await job_profile_repo.get_default_for_user(self.db, user_id)

        if not profile or not profile.resume_id:
            return False

        # Check if the linked resume has text content
        resume = await resume_repo.get_by_id(self.db, profile.resume_id)
        return bool(resume and resume.text_content and resume.text_content.strip())

    async def get_resume_text(self, user_id: UUID, profile_id: UUID | None = None) -> str | None:
        """Get resume text from the resume linked to the specified or default profile."""
        if profile_id:
            profile = await job_profile_repo.get_by_id(self.db, profile_id)
        else:
            profile = await job_profile_repo.get_default_for_user(self.db, user_id)

        if not profile or not profile.resume_id:
            return None

        # Get text from linked resume
        resume = await resume_repo.get_by_id(self.db, profile.resume_id)
        if not resume:
            return None
        return resume.text_content

    async def _ensure_single_default(self, user_id: UUID, default_profile_id: UUID) -> None:
        """Ensure only one profile is marked as default."""
        profiles = await job_profile_repo.get_by_user_id(self.db, user_id)
        for profile in profiles:
            if profile.id != default_profile_id and profile.is_default:
                await job_profile_repo.update(
                    self.db, db_profile=profile, update_data={"is_default": False}
                )
