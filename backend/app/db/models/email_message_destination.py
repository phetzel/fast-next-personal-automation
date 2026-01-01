"""Email message destination junction table for routing results."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.email_destination import EmailDestination
    from app.db.models.email_message import EmailMessage


class EmailMessageDestination(Base):
    """Junction table linking messages to destinations with processing results.

    Tracks which emails were routed to which destinations and the
    results of processing (items extracted, parser used, errors).
    """

    __tablename__ = "email_message_destinations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    message_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_messages.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    destination_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_destinations.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Processing info
    processed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    parser_used: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "indeed", "linkedin", "ai"

    # Results
    items_extracted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processing_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Reference to created items (flexible JSON array of UUIDs)
    created_item_ids: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Relationships
    message: Mapped["EmailMessage"] = relationship("EmailMessage", back_populates="destinations")
    destination: Mapped["EmailDestination"] = relationship(
        "EmailDestination", back_populates="message_destinations"
    )

    def __repr__(self) -> str:
        return f"<EmailMessageDestination(message={self.message_id}, dest={self.destination_id}, items={self.items_extracted})>"
