"""Story service (PostgreSQL async).

Contains business logic for story operations.
Uses story repository for database access.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.story import Story
from app.repositories import story_repo
from app.repositories.story import StoryRepository
from app.schemas.story import StoryCreate, StoryUpdate
from app.services.base import PrimaryEntityService


class StoryService(PrimaryEntityService[Story, StoryRepository]):
    """Service for story business logic."""

    entity_name = "Story"

    def __init__(self, db: AsyncSession):
        super().__init__(db, story_repo._repository)

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

        async def create_story(is_primary: bool) -> Story:
            return await story_repo.create(
                self.db,
                user_id=user_id,
                name=data.name,
                content=data.content,
                is_primary=is_primary,
            )

        return await self._create_with_primary_check(
            user_id,
            data.is_primary,
            create_story,
        )

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

        updated = await story_repo.update(self.db, db_story=story, update_data=data)

        # If marked as primary, unset other primary
        if data.get("is_primary"):
            await self._ensure_single_primary(user_id, story_id)

        return updated
