"""Email source database model for connected email accounts."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.email_message import EmailMessage
    from app.db.models.user import User


class EmailSource(Base, TimestampMixin):
    """Connected email account for job email parsing.

    Stores OAuth tokens and sync state for connected email providers.
    Currently supports Gmail for reading job alert emails.
    """

    __tablename__ = "email_sources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Email account details
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="gmail")

    # OAuth tokens (encrypted at rest using Fernet via email_source_repo)
    # Use email_source_repo.get_decrypted_tokens() to retrieve plaintext tokens
    access_token: Mapped[str] = mapped_column(Text, nullable=False)
    refresh_token: Mapped[str] = mapped_column(Text, nullable=False)
    token_expiry: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Sync state
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_sync_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Custom senders to watch (in addition to default job boards)
    # Format: ["sender@example.com", "alerts@company.com"]
    custom_senders: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    messages: Mapped[list["EmailMessage"]] = relationship(
        "EmailMessage",
        back_populates="source",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<EmailSource(id={self.id}, email={self.email_address}, provider={self.provider})>"
