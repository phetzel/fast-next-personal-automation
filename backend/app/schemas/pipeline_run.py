"""Pipeline run API schemas.

Pydantic models for pipeline run tracking and history.
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field

from app.db.models.pipeline_run import PipelineRunStatus, PipelineTriggerType


class PipelineRunBase(BaseModel):
    """Base schema for pipeline runs."""

    pipeline_name: str = Field(..., description="Name of the executed pipeline")
    trigger_type: PipelineTriggerType = Field(
        ..., description="How the pipeline was triggered"
    )
    input_data: dict[str, Any] | None = Field(
        None, description="Input data passed to the pipeline"
    )
    run_metadata: dict[str, Any] | None = Field(
        None, description="Additional context/metadata"
    )


class PipelineRunCreate(PipelineRunBase):
    """Schema for creating a pipeline run record."""

    user_id: UUID | None = Field(None, description="User who triggered the run")


class PipelineRunResponse(BaseModel):
    """Schema for pipeline run API responses."""

    id: UUID = Field(..., description="Unique run identifier")
    pipeline_name: str = Field(..., description="Name of the executed pipeline")
    status: PipelineRunStatus = Field(..., description="Current run status")
    trigger_type: PipelineTriggerType = Field(
        ..., description="How the pipeline was triggered"
    )
    user_id: UUID | None = Field(None, description="User who triggered the run")
    input_data: dict[str, Any] | None = Field(
        None, description="Input data passed to the pipeline"
    )
    output_data: dict[str, Any] | None = Field(
        None, description="Output data from the pipeline"
    )
    error_message: str | None = Field(None, description="Error message if failed")
    run_metadata: dict[str, Any] | None = Field(
        None, description="Additional context/metadata"
    )
    started_at: datetime | None = Field(None, description="When execution started")
    completed_at: datetime | None = Field(None, description="When execution completed")
    duration_ms: int | None = Field(None, description="Execution duration in milliseconds")
    created_at: datetime = Field(..., description="When the run record was created")

    class Config:
        from_attributes = True


class PipelineRunListResponse(BaseModel):
    """Response containing list of pipeline runs with pagination."""

    runs: list[PipelineRunResponse] = Field(..., description="List of pipeline runs")
    total: int = Field(..., description="Total number of runs matching filters")
    page: int = Field(..., description="Current page number")
    page_size: int = Field(..., description="Number of items per page")
    has_more: bool = Field(..., description="Whether there are more pages")


class PipelineRunFilters(BaseModel):
    """Query parameters for filtering pipeline runs."""

    pipeline_name: str | None = Field(None, description="Filter by pipeline name")
    status: PipelineRunStatus | None = Field(None, description="Filter by status")
    trigger_type: PipelineTriggerType | None = Field(
        None, description="Filter by trigger type"
    )
    started_after: datetime | None = Field(
        None, description="Filter runs started after this time"
    )
    started_before: datetime | None = Field(
        None, description="Filter runs started before this time"
    )
    success_only: bool = Field(False, description="Only return successful runs")
    error_only: bool = Field(False, description="Only return failed runs")


class PipelineRunStatsResponse(BaseModel):
    """Statistics about pipeline runs."""

    total: int = Field(..., description="Total number of runs")
    success: int = Field(..., description="Number of successful runs")
    errors: int = Field(..., description="Number of failed runs")
    success_rate: float = Field(..., description="Success rate percentage")
    avg_duration_ms: int | None = Field(
        None, description="Average execution duration in milliseconds"
    )


class PipelineRunWithUser(PipelineRunResponse):
    """Pipeline run with user information."""

    user_email: str | None = Field(None, description="Email of user who triggered run")
    user_name: str | None = Field(None, description="Name of user who triggered run")

