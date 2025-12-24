"""Story service (PostgreSQL async).

Contains business logic for story operations.
Uses story repository for database access.
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.models.story import Story
from app.repositories import story_repo
from app.schemas.story import StoryCreate, StoryUpdate

logger = logging.getLogger(__name__)


class StoryService:
    """Service for story business logic."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_by_id(self, story_id: UUID, user_id: UUID) -> Story:
        """Get story by ID, ensuring it belongs to the user.

        Raises:
            NotFoundError: If story does not exist or doesn't belong to user.
        """
        story = await story_repo.get_by_id(self.db, story_id)
        if not story or story.user_id != user_id:
            raise NotFoundError(
                message="Story not found",
                details={"story_id": str(story_id)},
            )
        return story

    async def list_for_user(self, user_id: UUID) -> list[Story]:
        """Get all stories for a user, ordered by primary status and creation date."""
        return await story_repo.get_by_user_id(self.db, user_id)

    async def get_primary_for_user(self, user_id: UUID) -> Story | None:
        """Get the primary story for a user, or None if none exists."""
        return await story_repo.get_primary_for_user(self.db, user_id)

    async def create(
        self,
        user_id: UUID,
        data: StoryCreate,
    ) -> Story:
        """Create a new story.

        Args:
            user_id: The user who owns the story
            data: Story creation data

        Returns:
            The created story
        """
        # Check if this should be the primary story
        is_primary = data.is_primary
        if not is_primary:
            existing_stories = await story_repo.get_by_user_id(self.db, user_id)
            if not existing_stories:
                # First story is always primary
                is_primary = True

        # Create database record
        story = await story_repo.create(
            self.db,
            user_id=user_id,
            name=data.name,
            content=data.content,
            is_primary=is_primary,
        )

        # If marked as primary, unset other primary
        if is_primary:
            await self._ensure_single_primary(user_id, story.id)

        return story

    async def update(
        self,
        story_id: UUID,
        user_id: UUID,
        update_data: StoryUpdate,
    ) -> Story:
        """Update a story.

        Raises:
            NotFoundError: If story does not exist.
        """
        story = await self.get_by_id(story_id, user_id)
        data = update_data.model_dump(exclude_unset=True)

        updated = await story_repo.update(
            self.db, db_story=story, update_data=data
        )

        # If marked as primary, unset other primary
        if data.get("is_primary"):
            await self._ensure_single_primary(user_id, story_id)

        return updated

    async def set_primary(self, user_id: UUID, story_id: UUID) -> Story:
        """Set a story as the primary.

        Raises:
            NotFoundError: If story does not exist or doesn't belong to user.
        """
        # Verify ownership
        await self.get_by_id(story_id, user_id)

        result = await story_repo.set_primary(self.db, user_id, story_id)
        if not result:
            raise NotFoundError(
                message="Story not found",
                details={"story_id": str(story_id)},
            )
        return result

    async def delete(self, story_id: UUID, user_id: UUID) -> Story:
        """Delete a story.

        If deleting the primary story, another story will become primary.

        Raises:
            NotFoundError: If story does not exist.
        """
        story = await self.get_by_id(story_id, user_id)
        was_primary = story.is_primary

        deleted = await story_repo.delete(self.db, story_id)
        if not deleted:
            raise NotFoundError(
                message="Story not found",
                details={"story_id": str(story_id)},
            )

        # If we deleted the primary, set another story as primary
        if was_primary:
            remaining = await story_repo.get_by_user_id(self.db, user_id)
            if remaining:
                await story_repo.set_primary(self.db, user_id, remaining[0].id)

        return deleted

    async def _ensure_single_primary(
        self, user_id: UUID, primary_story_id: UUID
    ) -> None:
        """Ensure only one story is marked as primary."""
        stories = await story_repo.get_by_user_id(self.db, user_id)
        for story in stories:
            if story.id != primary_story_id and story.is_primary:
                await story_repo.update(
                    self.db, db_story=story, update_data={"is_primary": False}
                )

