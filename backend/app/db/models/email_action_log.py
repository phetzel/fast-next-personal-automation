"""Email cleanup action log model."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.dialects.postgresql import JSON, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.email_message import EmailMessage
    from app.db.models.user import User


class EmailActionLog(Base, TimestampMixin):
    """Audit trail for cleanup suggestions and user review decisions."""

    __tablename__ = "email_action_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("email_messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    gmail_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    normalized_sender: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sender_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action_type: Mapped[str] = mapped_column(String(50), nullable=False)
    action_status: Mapped[str] = mapped_column(String(20), nullable=False)
    action_source: Mapped[str] = mapped_column(String(20), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_metadata: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    user: Mapped["User"] = relationship("User", lazy="selectin")
    message: Mapped["EmailMessage | None"] = relationship("EmailMessage", lazy="selectin")

    def __repr__(self) -> str:
        return (
            "EmailActionLog("
            f"id={self.id}, action_type={self.action_type}, action_status={self.action_status}"
            ")"
        )
