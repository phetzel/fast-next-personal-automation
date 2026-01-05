"""Story repository (PostgreSQL async).

Contains database operations for Story entity. Business logic
should be handled by StoryService in app/services/story.py.
"""

from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.story import Story
from app.repositories.base import PrimaryEntityRepository
from app.schemas.story import StoryCreate, StoryUpdate


class StoryRepository(PrimaryEntityRepository[Story, StoryCreate, StoryUpdate]):
    """Repository for Story entity operations."""

    def __init__(self):
        super().__init__(Story)

    async def get_by_user_id(self, db: AsyncSession, user_id: UUID) -> list[Story]:
        """Get all stories for a user, ordered by primary status and creation date."""
        return await self.get_by_user_ordered(db, user_id)

    async def create(
        self,
        db: AsyncSession,
        *,
        user_id: UUID,
        name: str,
        content: str,
        is_primary: bool = False,
    ) -> Story:
        """Create a new story."""
        return await self.create_with_kwargs(
            db,
            user_id=user_id,
            name=name,
            content=content,
            is_primary=is_primary,
        )

    async def update(
        self,
        db: AsyncSession,
        *,
        db_story: Story,
        update_data: dict,
    ) -> Story:
        """Update a story."""
        return await super().update(db, db_obj=db_story, obj_in=update_data)

    async def delete(self, db: AsyncSession, story_id: UUID) -> Story | None:
        """Delete a story by ID."""
        return await super().delete(db, id=story_id)

    async def delete_by_user_id(self, db: AsyncSession, user_id: UUID) -> int:
        """Delete all stories for a user. Returns count of deleted stories."""
        return await self.delete_by_user(db, user_id)


# Module-level singleton for backward compatibility
_repository = StoryRepository()


# Expose module-level functions for backward compatibility
async def get_by_id(db: AsyncSession, story_id: UUID) -> Story | None:
    """Get story by ID."""
    return await _repository.get(db, story_id)


async def get_by_user_id(db: AsyncSession, user_id: UUID) -> list[Story]:
    """Get all stories for a user, ordered by primary status and creation date."""
    return await _repository.get_by_user_id(db, user_id)


async def get_primary_for_user(db: AsyncSession, user_id: UUID) -> Story | None:
    """Get the primary story for a user."""
    return await _repository.get_primary_for_user(db, user_id)


async def create(
    db: AsyncSession,
    *,
    user_id: UUID,
    name: str,
    content: str,
    is_primary: bool = False,
) -> Story:
    """Create a new story."""
    return await _repository.create(
        db,
        user_id=user_id,
        name=name,
        content=content,
        is_primary=is_primary,
    )


async def update(
    db: AsyncSession,
    *,
    db_story: Story,
    update_data: dict,
) -> Story:
    """Update a story."""
    return await _repository.update(db, db_story=db_story, update_data=update_data)


async def set_primary(
    db: AsyncSession,
    user_id: UUID,
    story_id: UUID,
) -> Story | None:
    """Set a story as primary, unsetting any other primary."""
    return await _repository.set_primary(db, user_id, story_id)


async def delete(db: AsyncSession, story_id: UUID) -> Story | None:
    """Delete a story by ID."""
    return await _repository.delete(db, story_id)


async def delete_by_user_id(db: AsyncSession, user_id: UUID) -> int:
    """Delete all stories for a user. Returns count of deleted stories."""
    return await _repository.delete_by_user_id(db, user_id)
