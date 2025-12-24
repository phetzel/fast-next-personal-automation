"""Resume database model for storing uploaded resume files."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class Resume(Base, TimestampMixin):
    """Resume model for storing uploaded resume files.

    Stores file metadata and extracted text content for AI analysis.
    Users can have multiple resumes and share them across job profiles.
    One resume can be marked as primary for quick access.
    """

    __tablename__ = "resumes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # User-friendly name for the resume
    name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Original filename from upload
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)

    # Storage path (relative to storage root)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)

    # File metadata
    file_size: Mapped[int] = mapped_column(Integer, nullable=False)
    mime_type: Mapped[str] = mapped_column(String(100), nullable=False)

    # Extracted text content for AI analysis
    text_content: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Primary resume flag (user's main resume)
    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    # Relationship
    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Resume(id={self.id}, name={self.name}, user_id={self.user_id})>"
