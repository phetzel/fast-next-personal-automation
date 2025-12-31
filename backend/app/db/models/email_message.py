"""Email message database model for processed job alert emails."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.email_source import EmailSource


class EmailMessage(Base, TimestampMixin):
    """Processed email message record.

    Tracks which emails have been processed to prevent re-processing
    and provides an audit trail of extracted jobs.
    """

    __tablename__ = "email_messages"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_sources.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Gmail message identifiers (for deduplication)
    gmail_message_id: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Email metadata
    subject: Mapped[str] = mapped_column(String(1000), nullable=False)
    from_address: Mapped[str] = mapped_column(String(255), nullable=False)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Processing results
    jobs_extracted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    parser_used: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "indeed", "ai", etc.
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    # Relationships
    source: Mapped["EmailSource"] = relationship("EmailSource", back_populates="messages")

    def __repr__(self) -> str:
        return (
            f"<EmailMessage(id={self.id}, subject={self.subject[:50]}, jobs={self.jobs_extracted})>"
        )
