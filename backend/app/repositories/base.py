"""Base repository with generic CRUD operations.

Provides reusable async CRUD operations for SQLAlchemy models.
Repositories can inherit from BaseRepository for common functionality.
"""

from typing import Any, Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import Base

ModelType = TypeVar("ModelType", bound=Base)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)


class BaseRepository(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Base class for repository operations.

    Provides generic CRUD operations for SQLAlchemy models.
    Subclasses should specify the model type via the model attribute.

    Example:
        class StoryRepository(BaseRepository[Story, StoryCreate, StoryUpdate]):
            def __init__(self):
                super().__init__(Story)
    """

    def __init__(self, model: type[ModelType]):
        self.model = model

    async def get(self, db: AsyncSession, id: Any) -> ModelType | None:
        """Get a single record by ID."""
        return await db.get(self.model, id)

    async def get_multi(
        self,
        db: AsyncSession,
        *,
        skip: int = 0,
        limit: int = 100,
    ) -> list[ModelType]:
        """Get multiple records with pagination."""
        result = await db.execute(select(self.model).offset(skip).limit(limit))
        return list(result.scalars().all())

    async def create(
        self,
        db: AsyncSession,
        *,
        obj_in: CreateSchemaType,
    ) -> ModelType:
        """Create a new record from a Pydantic schema."""
        obj_in_data = obj_in.model_dump()
        db_obj = self.model(**obj_in_data)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def create_with_kwargs(
        self,
        db: AsyncSession,
        **kwargs: Any,
    ) -> ModelType:
        """Create a new record from keyword arguments."""
        db_obj = self.model(**kwargs)
        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def update(
        self,
        db: AsyncSession,
        *,
        db_obj: ModelType,
        obj_in: UpdateSchemaType | dict[str, Any],
    ) -> ModelType:
        """Update a record."""
        update_data = obj_in if isinstance(obj_in, dict) else obj_in.model_dump(exclude_unset=True)

        for field, value in update_data.items():
            setattr(db_obj, field, value)

        db.add(db_obj)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj

    async def delete(self, db: AsyncSession, *, id: Any) -> ModelType | None:
        """Delete a record by ID."""
        obj = await self.get(db, id)
        if obj:
            await db.delete(obj)
            await db.flush()
        return obj


class UserOwnedRepository(BaseRepository[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Repository for models that belong to a user.

    Extends BaseRepository with user-scoped queries.
    Models must have a user_id field.
    """

    async def get_by_user(
        self,
        db: AsyncSession,
        user_id: UUID,
        *,
        order_by: Any | None = None,
    ) -> list[ModelType]:
        """Get all records for a user."""
        query = select(self.model).where(self.model.user_id == user_id)  # type: ignore
        if order_by is not None:
            query = query.order_by(order_by)
        result = await db.execute(query)
        return list(result.scalars().all())

    async def get_by_id_and_user(
        self,
        db: AsyncSession,
        id: UUID,
        user_id: UUID,
    ) -> ModelType | None:
        """Get a record by ID, ensuring it belongs to the user."""
        result = await db.execute(
            select(self.model).where(
                self.model.id == id,  # type: ignore
                self.model.user_id == user_id,  # type: ignore
            )
        )
        return result.scalar_one_or_none()


class PrimaryEntityRepository(UserOwnedRepository[ModelType, CreateSchemaType, UpdateSchemaType]):
    """Repository for models that have a primary/default flag.

    Extends UserOwnedRepository with primary entity management.
    Models must have an is_primary or is_default boolean field.
    """

    primary_field: str = "is_primary"  # Override to "is_default" if needed

    async def get_by_user_ordered(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> list[ModelType]:
        """Get all records for a user, ordered by primary status then created_at."""
        primary_col = getattr(self.model, self.primary_field)
        created_col = self.model.created_at
        result = await db.execute(
            select(self.model)
            .where(self.model.user_id == user_id)  # type: ignore
            .order_by(primary_col.desc(), created_col.desc())
        )
        return list(result.scalars().all())

    async def get_primary_for_user(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> ModelType | None:
        """Get the primary/default record for a user."""
        primary_col = getattr(self.model, self.primary_field)
        result = await db.execute(
            select(self.model).where(
                self.model.user_id == user_id,  # type: ignore
                primary_col == True,  # noqa: E712
            )
        )
        return result.scalar_one_or_none()

    async def set_primary(
        self,
        db: AsyncSession,
        user_id: UUID,
        id: UUID,
    ) -> ModelType | None:
        """Set a record as primary, unsetting any other primary.

        Returns the updated record, or None if not found.
        """
        # Unset all primary for this user
        records = await self.get_by_user_ordered(db, user_id)
        for record in records:
            if getattr(record, self.primary_field) and record.id != id:  # type: ignore
                setattr(record, self.primary_field, False)
                db.add(record)

        # Set the new primary
        target = await self.get(db, id)
        if target and target.user_id == user_id:  # type: ignore
            setattr(target, self.primary_field, True)
            db.add(target)
            await db.flush()
            await db.refresh(target)
            return target

        return None

    async def delete_by_user(
        self,
        db: AsyncSession,
        user_id: UUID,
    ) -> int:
        """Delete all records for a user. Returns count of deleted records."""
        records = await self.get_by_user(db, user_id)
        count = len(records)
        for record in records:
            await db.delete(record)
        await db.flush()
        return count
