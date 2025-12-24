"""Pipeline API schemas.

Pydantic models for pipeline-related API requests and responses.
"""

from typing import Any

from pydantic import BaseModel, Field


class PipelineExecuteRequest(BaseModel):
    """Request body for executing a pipeline."""

    input: dict[str, Any] = Field(
        ...,
        description="Input data for the pipeline (validated against pipeline's input schema)",
    )


class PipelineExecuteResponse(BaseModel):
    """Response from pipeline execution."""

    success: bool = Field(..., description="Whether the pipeline executed successfully")
    output: dict[str, Any] | None = Field(
        None,
        description="Pipeline output if successful",
    )
    error: str | None = Field(
        None,
        description="Error message if execution failed",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata about the execution",
    )


class PipelineInfo(BaseModel):
    """Information about a registered pipeline."""

    name: str = Field(..., description="Unique pipeline identifier")
    description: str = Field(..., description="Human-readable description")
    input_schema: dict[str, Any] = Field(
        ...,
        description="JSON Schema for pipeline input validation",
    )
    output_schema: dict[str, Any] = Field(
        ...,
        description="JSON Schema for pipeline output",
    )
    tags: list[str] = Field(
        default_factory=list,
        description="Tags for fine-grained filtering",
    )
    area: str | None = Field(
        default=None,
        description="Primary area association for grouping",
    )


class PipelineListResponse(BaseModel):
    """Response containing list of available pipelines."""

    pipelines: list[PipelineInfo] = Field(
        ...,
        description="List of available pipelines",
    )
    total: int = Field(..., description="Total number of pipelines")


class PipelineWebhookPayload(BaseModel):
    """Payload for incoming webhook pipeline execution.

    Webhooks can include additional metadata alongside the input.
    """

    input: dict[str, Any] = Field(
        ...,
        description="Input data for the pipeline",
    )
    metadata: dict[str, Any] = Field(
        default_factory=dict,
        description="Additional metadata to pass to the pipeline context",
    )

