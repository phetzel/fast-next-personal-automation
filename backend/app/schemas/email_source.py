"""Schemas for email source operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EmailSourceBase(BaseModel):
    """Base email source schema."""

    email_address: str
    provider: str = "gmail"
    is_active: bool = True
    custom_senders: list[str] | None = None


class EmailSourceCreate(BaseModel):
    """Schema for creating an email source (internal use)."""

    email_address: str
    provider: str = "gmail"
    access_token: str
    refresh_token: str
    token_expiry: datetime | None = None
    custom_senders: list[str] | None = None


class EmailSourceUpdate(BaseModel):
    """Schema for updating an email source."""

    is_active: bool | None = None
    custom_senders: list[str] | None = None


class EmailSourceResponse(BaseModel):
    """Response schema for email source."""

    id: UUID
    email_address: str
    provider: str
    is_active: bool
    last_sync_at: datetime | None
    last_sync_error: str | None
    custom_senders: list[str] | None
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class EmailMessageResponse(BaseModel):
    """Response schema for email message."""

    id: UUID
    sync_id: UUID | None = None
    gmail_message_id: str
    subject: str | None = None
    from_address: str
    to_address: str | None = None
    received_at: datetime | None = None
    jobs_extracted: int
    parser_used: str | None
    processing_error: str | None
    processed_at: datetime | None = None

    model_config = {"from_attributes": True}


class EmailSourceStats(BaseModel):
    """Statistics for an email source."""

    total_messages: int = 0
    total_jobs_extracted: int = 0
    successful_parses: int = 0
    failed_parses: int = 0


class EmailSourceWithStats(EmailSourceResponse):
    """Email source with statistics."""

    stats: EmailSourceStats


class EmailSyncInput(BaseModel):
    """Input for email sync pipeline."""

    source_id: UUID | None = Field(
        default=None,
        description="Specific email source to sync. If not provided, syncs all active sources for the user.",
    )
    force_full_sync: bool = Field(
        default=False,
        description="If true, syncs all emails regardless of last_sync_at.",
    )


class EmailSyncOutput(BaseModel):
    """Output from email sync pipeline."""

    emails_processed: int = Field(description="Number of emails processed")
    jobs_extracted: int = Field(description="Number of jobs extracted")
    jobs_saved: int = Field(description="Number of new jobs saved (after deduplication)")
    errors: list[str] = Field(default_factory=list, description="Any errors encountered")


class DefaultSenderInfo(BaseModel):
    """Information about a default job sender."""

    domain: str
    display_name: str
    parser_name: str


class EmailConfigResponse(BaseModel):
    """Response with email configuration info."""

    default_senders: list[DefaultSenderInfo]
    sync_interval_minutes: int
