"""Story database model for storing user story/narrative text."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Story(Base, TimestampMixin):
    """Story model for storing user narrative text.

    Stores personal story/narrative text that users want to emphasize
    during job applications. Users can have multiple stories and 
    one can be marked as primary for quick access.
    """

    __tablename__ = "stories"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User-friendly name for the story
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    # The story content (markdown supported)
    content: Mapped[str] = mapped_column(
        Text, nullable=False
    )

    # Primary story flag (user's main story)
    is_primary: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    # Relationship
    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Story(id={self.id}, name={self.name}, user_id={self.user_id})>"

