"""Project database model for storing project descriptions."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Project(Base, TimestampMixin):
    """Project model for storing project descriptions.

    Stores project descriptions (markdown files) that users want to reference
    during job applications. Unlike resumes and stories, multiple projects
    can be active at once - each has its own is_active toggle.
    """

    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User-friendly name for the project
    name: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    # Original filename from upload (for markdown files)
    original_filename: Mapped[str] = mapped_column(
        String(255), nullable=False
    )

    # Storage path (relative to storage root)
    file_path: Mapped[str] = mapped_column(
        String(500), nullable=False
    )

    # File metadata
    file_size: Mapped[int] = mapped_column(
        Integer, nullable=False
    )
    mime_type: Mapped[str] = mapped_column(
        String(100), nullable=False
    )

    # Extracted/stored text content (markdown content)
    text_content: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )

    # Active toggle - multiple projects can be active
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    # Relationship
    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Project(id={self.id}, name={self.name}, user_id={self.user_id})>"

