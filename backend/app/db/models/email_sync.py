"""Email sync database model for tracking sync operations."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.db.models.email_message import EmailMessage
    from app.db.models.user import User


class EmailSync(Base):
    """Tracks email sync operations.

    Each sync operation processes all active email sources for a user
    and records aggregated statistics and per-source breakdowns.
    """

    __tablename__ = "email_syncs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Timing
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Status: pending, running, completed, failed
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="pending", index=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Aggregated stats
    sources_synced: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    emails_fetched: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    emails_processed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Flexible extra data (per-source breakdowns, jobs created, etc.)
    # Note: Can't use 'metadata' as it's reserved by SQLAlchemy
    sync_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    messages: Mapped[list["EmailMessage"]] = relationship(
        "EmailMessage",
        back_populates="sync",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<EmailSync(id={self.id}, status={self.status}, emails={self.emails_processed})>"
