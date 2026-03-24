"""Shared schema for linked email context across domains."""

from datetime import datetime
from uuid import UUID

from app.schemas.base import BaseSchema


class LinkedEmailContext(BaseSchema):
    """Email context attached to jobs and finance transactions for traceability."""

    id: UUID
    source_email_address: str
    gmail_message_id: str
    gmail_thread_id: str | None = None
    subject: str | None = None
    from_address: str
    received_at: datetime | None = None
    bucket: str | None = None
    summary: str | None = None
