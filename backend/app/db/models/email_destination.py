"""Email destination database model for routing rules."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.email_message_destination import EmailMessageDestination
    from app.db.models.user import User


class EmailDestination(Base, TimestampMixin):
    """Defines routing rules for where emails should be processed.

    Users can configure destinations with filter rules based on sender
    patterns and subject matching. Emails matching a destination's rules
    will be processed by the configured parser and routed accordingly.
    """

    __tablename__ = "email_destinations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Destination info
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    destination_type: Mapped[str] = mapped_column(
        String(50), nullable=False, default="jobs"
    )  # "jobs" for now, extensible to "tasks", "notes"

    # Matching rules (JSON)
    # Example: {
    #   "sender_patterns": ["indeed.com", "linkedin.com"],
    #   "subject_contains": ["job", "opportunity"],
    #   "subject_not_contains": ["unsubscribe"]
    # }
    filter_rules: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    # Processing config
    parser_name: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )  # "indeed", "linkedin", "ai", None (auto-detect)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    priority: Mapped[int] = mapped_column(
        Integer, default=0, nullable=False
    )  # Higher = checked first

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    message_destinations: Mapped[list["EmailMessageDestination"]] = relationship(
        "EmailMessageDestination",
        back_populates="destination",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<EmailDestination(id={self.id}, name={self.name}, type={self.destination_type})>"
