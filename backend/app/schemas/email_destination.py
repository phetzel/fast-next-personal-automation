"""Schemas for email destination operations."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class FilterRules(BaseModel):
    """Filter rules for matching emails to destinations."""

    sender_patterns: list[str] = Field(
        default_factory=list,
        description="List of sender domain/email patterns to match (e.g., 'indeed.com', 'jobs@company.com')",
    )
    subject_contains: list[str] = Field(
        default_factory=list,
        description="Subject must contain at least one of these terms",
    )
    subject_not_contains: list[str] = Field(
        default_factory=list,
        description="Subject must not contain any of these terms",
    )


class EmailDestinationCreate(BaseModel):
    """Schema for creating an email destination."""

    name: str = Field(..., min_length=1, max_length=255)
    destination_type: str = Field(default="jobs", description="Type of destination: 'jobs'")
    filter_rules: FilterRules | None = None
    parser_name: str | None = Field(
        default=None,
        description="Parser to use: 'indeed', 'linkedin', 'ai', or None for auto-detect",
    )
    is_active: bool = True
    priority: int = Field(default=0, description="Higher priority destinations are checked first")


class EmailDestinationUpdate(BaseModel):
    """Schema for updating an email destination."""

    name: str | None = Field(default=None, min_length=1, max_length=255)
    filter_rules: FilterRules | None = None
    parser_name: str | None = None
    is_active: bool | None = None
    priority: int | None = None


class EmailDestinationResponse(BaseModel):
    """Response schema for email destination."""

    id: UUID
    user_id: UUID
    name: str
    destination_type: str
    filter_rules: dict | None
    parser_name: str | None
    is_active: bool
    priority: int
    created_at: datetime
    updated_at: datetime | None

    model_config = {"from_attributes": True}


class EmailDestinationStats(BaseModel):
    """Statistics for an email destination."""

    total_processed: int = 0
    total_items_extracted: int = 0
    successful: int = 0
    failed: int = 0


class EmailDestinationWithStats(EmailDestinationResponse):
    """Email destination with statistics."""

    stats: EmailDestinationStats


class EmailMessageDestinationResponse(BaseModel):
    """Response schema for email message destination processing record."""

    id: UUID
    message_id: UUID
    destination_id: UUID
    processed_at: datetime
    parser_used: str | None
    items_extracted: int
    processing_error: str | None
    created_item_ids: list[str] | None

    model_config = {"from_attributes": True}
