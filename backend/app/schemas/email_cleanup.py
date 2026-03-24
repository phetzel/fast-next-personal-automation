"""Schemas for email cleanup review surfaces."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EmailSubscriptionMessagePreview(BaseModel):
    """Compact message preview for a grouped cleanup sender."""

    id: UUID
    subject: str | None = None
    received_at: datetime | None = None
    source_email_address: str
    bucket: str | None = None
    unsubscribe_candidate: bool
    archive_recommended: bool


class EmailSubscriptionGroupResponse(BaseModel):
    """Grouped cleanup candidates by sender domain."""

    sender_domain: str
    representative_sender: str
    representative_message_id: UUID
    total_messages: int
    unsubscribe_count: int
    archive_count: int
    latest_received_at: datetime | None = None
    sample_messages: list[EmailSubscriptionMessagePreview] = Field(default_factory=list)


class EmailSubscriptionListResponse(BaseModel):
    """Paginated grouped cleanup candidates."""

    items: list[EmailSubscriptionGroupResponse]
    total: int
    limit: int
    offset: int


class EmailCleanupDecisionInput(BaseModel):
    """Optional reason payload for cleanup approve/dismiss actions."""

    reason: str | None = Field(default=None, max_length=500)


class EmailActionLogResponse(BaseModel):
    """Serialized cleanup audit log item."""

    id: UUID
    message_id: UUID | None = None
    message_subject: str | None = None
    gmail_thread_id: str | None = None
    normalized_sender: str | None = None
    sender_domain: str | None = None
    action_type: str
    action_status: str
    action_source: str
    reason: str | None = None
    metadata: dict | None = None
    created_at: datetime


class EmailActionLogListResponse(BaseModel):
    """Paginated audit log list."""

    items: list[EmailActionLogResponse]
    total: int
    limit: int
    offset: int
