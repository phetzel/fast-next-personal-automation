"""Base service classes with common patterns.

Provides reusable service functionality for business logic operations.
Services can inherit from these base classes for common functionality.
"""

from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.db.base import Base
from app.repositories.base import PrimaryEntityRepository, UserOwnedRepository

ModelType = TypeVar("ModelType", bound=Base)
RepoType = TypeVar("RepoType", bound=UserOwnedRepository)


class BaseService(Generic[ModelType, RepoType]):
    """Base service with common patterns.

    Provides common service functionality like ownership checks.
    """

    entity_name: str = "Entity"  # Override in subclasses for error messages

    def __init__(self, db: AsyncSession, repo: RepoType):
        self.db = db
        self.repo = repo

    async def get_by_id(self, entity_id: UUID, user_id: UUID) -> ModelType:
        """Get entity by ID, ensuring it belongs to the user.

        Args:
            entity_id: The entity ID.
            user_id: The user ID for ownership verification.

        Returns:
            The entity if found and owned by user.

        Raises:
            NotFoundError: If entity does not exist or doesn't belong to user.
        """
        entity = await self.repo.get(self.db, entity_id)
        if not entity or entity.user_id != user_id:  # type: ignore
            raise NotFoundError(
                message=f"{self.entity_name} not found",
                details={f"{self.entity_name.lower()}_id": str(entity_id)},
            )
        return entity  # type: ignore

    async def list_for_user(self, user_id: UUID) -> list[ModelType]:
        """Get all entities for a user.

        Args:
            user_id: The user ID.

        Returns:
            List of entities belonging to the user.
        """
        return await self.repo.get_by_user(self.db, user_id)  # type: ignore


class PrimaryEntityService(BaseService[ModelType, RepoType]):
    """Service for entities with a primary/default flag.

    Extends BaseService with primary entity management.
    Requires repository to be a PrimaryEntityRepository.
    """

    primary_field: str = "is_primary"  # Override to "is_default" if needed
    repo: PrimaryEntityRepository  # type: ignore

    async def list_for_user(self, user_id: UUID) -> list[ModelType]:
        """Get all entities for a user, ordered by primary status."""
        return await self.repo.get_by_user_ordered(self.db, user_id)  # type: ignore

    async def get_primary_for_user(self, user_id: UUID) -> ModelType | None:
        """Get the primary entity for a user, or None if none exists."""
        return await self.repo.get_primary_for_user(self.db, user_id)  # type: ignore

    async def set_primary(self, user_id: UUID, entity_id: UUID) -> ModelType:
        """Set an entity as the primary.

        Args:
            user_id: The user ID.
            entity_id: The entity ID to set as primary.

        Returns:
            The updated entity.

        Raises:
            NotFoundError: If entity does not exist or doesn't belong to user.
        """
        # Verify ownership
        await self.get_by_id(entity_id, user_id)

        result = await self.repo.set_primary(self.db, user_id, entity_id)
        if not result:
            raise NotFoundError(
                message=f"{self.entity_name} not found",
                details={f"{self.entity_name.lower()}_id": str(entity_id)},
            )
        return result  # type: ignore

    async def delete(self, entity_id: UUID, user_id: UUID) -> ModelType:
        """Delete an entity.

        If deleting the primary entity, another entity will become primary.

        Args:
            entity_id: The entity ID.
            user_id: The user ID for ownership verification.

        Returns:
            The deleted entity.

        Raises:
            NotFoundError: If entity does not exist or doesn't belong to user.
        """
        entity = await self.get_by_id(entity_id, user_id)
        was_primary = getattr(entity, self.primary_field, False)

        deleted = await self.repo.delete(self.db, id=entity_id)
        if not deleted:
            raise NotFoundError(
                message=f"{self.entity_name} not found",
                details={f"{self.entity_name.lower()}_id": str(entity_id)},
            )

        # If we deleted the primary, set another as primary
        if was_primary:
            remaining = await self.list_for_user(user_id)
            if remaining:
                await self.repo.set_primary(self.db, user_id, remaining[0].id)  # type: ignore

        return deleted  # type: ignore

    async def _ensure_single_primary(self, user_id: UUID, primary_entity_id: UUID) -> None:
        """Ensure only one entity is marked as primary.

        This is called after create/update when is_primary is set.
        The repository's set_primary method already handles this,
        but this can be used for additional logic if needed.
        """
        entities = await self.list_for_user(user_id)
        for entity in entities:
            if entity.id != primary_entity_id and getattr(entity, self.primary_field, False):  # type: ignore
                await self.repo.update(
                    self.db,
                    db_obj=entity,
                    obj_in={self.primary_field: False},
                )

    async def _create_with_primary_check(
        self,
        user_id: UUID,
        is_primary: bool,
        create_func: Any,
    ) -> ModelType:
        """Helper to handle primary flag on create.

        Sets as primary if:
        - Explicitly requested (is_primary=True)
        - First entity for user

        Args:
            user_id: The user ID.
            is_primary: Whether to set as primary.
            create_func: Async function that creates and returns the entity.

        Returns:
            The created entity.
        """
        # Check if this should be the primary
        should_be_primary = is_primary
        if not should_be_primary:
            existing = await self.list_for_user(user_id)
            if not existing:
                should_be_primary = True

        # Create the entity (pass should_be_primary to create_func)
        entity = await create_func(should_be_primary)

        # If marked as primary, ensure no other is primary
        if should_be_primary:
            await self._ensure_single_primary(user_id, entity.id)  # type: ignore

        return entity
