"""Scheduled task API schemas.

Pydantic models for calendar-based pipeline scheduling.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

# Valid event colors (matching Origin UI calendar)
EventColor = str  # "sky", "amber", "violet", "rose", "emerald", "orange"


class ScheduledTaskBase(BaseModel):
    """Base schema for scheduled tasks."""

    name: str = Field(..., min_length=1, max_length=255, description="Task display name")
    description: str | None = Field(None, description="Optional task description")
    pipeline_name: str = Field(
        ..., min_length=1, max_length=100, description="Name of the pipeline to execute"
    )
    cron_expression: str = Field(
        ...,
        min_length=9,  # Minimum valid cron: "* * * * *"
        max_length=100,
        description="Cron expression (e.g., '0 9 * * 1' for every Monday at 9am)",
    )
    timezone: str = Field(
        default="UTC",
        max_length=50,
        description="Timezone for the cron schedule",
    )
    enabled: bool = Field(default=True, description="Whether the schedule is active")
    input_params: dict[str, Any] | None = Field(
        None, description="Input parameters for the pipeline"
    )
    color: EventColor | None = Field(
        None,
        description="Color for calendar display (sky, amber, violet, rose, emerald, orange)",
    )


class ScheduledTaskCreate(ScheduledTaskBase):
    """Schema for creating a scheduled task."""

    pass


class ScheduledTaskUpdate(BaseModel):
    """Schema for updating a scheduled task."""

    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    pipeline_name: str | None = Field(None, min_length=1, max_length=100)
    cron_expression: str | None = Field(None, min_length=9, max_length=100)
    timezone: str | None = Field(None, max_length=50)
    enabled: bool | None = None
    input_params: dict[str, Any] | None = None
    color: EventColor | None = None


class ScheduledTaskResponse(ScheduledTaskBase):
    """Schema for scheduled task API responses."""

    id: UUID = Field(..., description="Unique task identifier")
    user_id: UUID = Field(..., description="Owner user ID")
    next_run_at: datetime | None = Field(None, description="Next scheduled execution time")
    last_run_at: datetime | None = Field(None, description="Last execution time")
    created_at: datetime = Field(..., description="When the task was created")
    updated_at: datetime | None = Field(None, description="When the task was last updated")

    model_config = ConfigDict(from_attributes=True)


class ScheduledTaskListResponse(BaseModel):
    """Response containing list of scheduled tasks with pagination."""

    tasks: list[ScheduledTaskResponse] = Field(..., description="List of scheduled tasks")
    total: int = Field(..., description="Total number of tasks matching filters")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    has_more: bool = Field(..., description="Whether there are more pages")


class CalendarOccurrence(BaseModel):
    """A single calendar occurrence (computed from cron expression)."""

    id: str = Field(..., description="Occurrence ID (task_id + timestamp)")
    task_id: UUID = Field(..., description="Source scheduled task ID")
    title: str = Field(..., description="Task name")
    description: str | None = Field(None, description="Task description")
    pipeline_name: str = Field(..., description="Pipeline to execute")
    start: datetime = Field(..., description="Occurrence start time")
    end: datetime = Field(..., description="Occurrence end time (start + 1 hour)")
    all_day: bool = Field(default=False, description="Whether it's an all-day event")
    color: EventColor | None = Field(None, description="Calendar event color")
    cron_expression: str = Field(..., description="Cron expression for reference")
    enabled: bool = Field(..., description="Whether the schedule is enabled")


class CalendarOccurrencesRequest(BaseModel):
    """Request parameters for getting calendar occurrences."""

    start_date: datetime = Field(..., description="Start of date range")
    end_date: datetime = Field(..., description="End of date range")
    pipeline_name: str | None = Field(None, description="Filter by pipeline name")
    enabled_only: bool = Field(default=True, description="Only return enabled schedules")


class CalendarOccurrencesResponse(BaseModel):
    """Response containing calendar occurrences for a date range."""

    occurrences: list[CalendarOccurrence] = Field(
        ..., description="List of computed calendar occurrences"
    )
    start_date: datetime = Field(..., description="Start of requested date range")
    end_date: datetime = Field(..., description="End of requested date range")
