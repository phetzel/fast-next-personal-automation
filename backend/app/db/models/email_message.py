"""Email message database model for processed emails."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.email_message_destination import EmailMessageDestination
    from app.db.models.email_source import EmailSource
    from app.db.models.email_sync import EmailSync


class EmailMessage(Base, TimestampMixin):
    """Processed email message record.

    Tracks which emails have been processed to prevent re-processing.
    Processing results are stored in EmailMessageDestination junction table.
    """

    __tablename__ = "email_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    sync_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_syncs.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Gmail message identifiers (for deduplication)
    gmail_message_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Email metadata
    subject: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    to_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Processing status
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # DEPRECATED: These fields are kept for backwards compatibility during migration
    # Use EmailMessageDestination for new processing results
    jobs_extracted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parser_used: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "indeed", "ai", etc.

    # Relationships
    source: Mapped["EmailSource"] = relationship("EmailSource", back_populates="messages")
    sync: Mapped["EmailSync | None"] = relationship("EmailSync", back_populates="messages")
    destinations: Mapped[list["EmailMessageDestination"]] = relationship(
        "EmailMessageDestination",
        back_populates="message",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        subject_preview = self.subject[:50] if self.subject else "(no subject)"
        return f"<EmailMessage(id={self.id}, subject={subject_preview})>"
