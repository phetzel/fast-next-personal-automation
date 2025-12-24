"""Action pipeline base classes.

Action pipelines are reusable automation units that can be invoked from:
- REST API (direct calls from frontend)
- Incoming webhooks (external services)
- AI Agent tool calls (conversational invocation)
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Generic, TypeVar, get_args, get_origin
from uuid import UUID

from pydantic import BaseModel


class PipelineSource(str, Enum):
    """Source of pipeline invocation."""

    API = "api"
    WEBHOOK = "webhook"
    AGENT = "agent"
    CRON = "cron"
    MANUAL = "manual"


@dataclass
class PipelineContext:
    """Context passed to pipeline execution.

    Provides information about the invocation source and authenticated user.
    Pipelines can use this to customize behavior based on how they were called.
    """

    source: PipelineSource
    user_id: UUID | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


# Type variables for generic input/output
InputT = TypeVar("InputT", bound=BaseModel)
OutputT = TypeVar("OutputT", bound=BaseModel)


@dataclass
class ActionResult(Generic[OutputT]):
    """Result of an action pipeline execution.

    Attributes:
        success: Whether the pipeline executed successfully.
        output: The typed output if successful.
        error: Error message if failed.
        metadata: Additional metadata about the execution.
    """

    success: bool
    output: OutputT | None = None
    error: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert result to dictionary for API responses."""
        result: dict[str, Any] = {
            "success": self.success,
            "error": self.error,
            "metadata": self.metadata,
        }
        if self.output is not None:
            result["output"] = self.output.model_dump()
        else:
            result["output"] = None
        return result


class ActionPipeline(ABC, Generic[InputT, OutputT]):
    """Base class for callable action pipelines.

    Unlike batch pipelines (BasePipeline), action pipelines are designed to be:
    - Invoked synchronously or async from multiple entry points
    - Type-safe with Pydantic input/output models
    - Discoverable via the pipeline registry

    Subclasses must:
    - Set `name` and `description` class attributes
    - Define input/output types via Generic parameters
    - Implement the `execute` method

    Subclasses may optionally set:
    - `tags`: List of strings for fine-grained filtering (e.g., ["jobs", "ai"])
    - `area`: Primary area association for grouping (e.g., "jobs")

    Example:
        class MyInput(BaseModel):
            message: str

        class MyOutput(BaseModel):
            result: str

        class MyPipeline(ActionPipeline[MyInput, MyOutput]):
            name = "my_pipeline"
            description = "Does something useful"
            tags = ["automation", "utility"]
            area = "general"

            async def execute(
                self, input: MyInput, context: PipelineContext
            ) -> ActionResult[MyOutput]:
                return ActionResult(
                    success=True,
                    output=MyOutput(result=f"Processed: {input.message}")
                )
    """

    # Subclasses must define these
    name: str
    description: str

    # Optional tagging for filtering and organization
    tags: list[str] = []
    area: str | None = None

    @abstractmethod
    async def execute(
        self, input: InputT, context: PipelineContext
    ) -> ActionResult[OutputT]:
        """Execute the pipeline action.

        Args:
            input: Validated input matching the pipeline's InputT type.
            context: Execution context with source and user info.

        Returns:
            ActionResult containing success status and typed output.
        """
        pass

    async def validate_input(self, input: InputT) -> bool:
        """Validate input before execution.

        Override this method to add custom validation logic beyond
        Pydantic's built-in validation.

        Args:
            input: The validated Pydantic input model.

        Returns:
            True if validation passes, False otherwise.
        """
        return True

    @classmethod
    def get_input_type(cls) -> type[BaseModel] | None:
        """Get the input Pydantic model type from Generic parameters."""
        for base in cls.__orig_bases__:  # type: ignore
            origin = get_origin(base)
            if origin is ActionPipeline:
                args = get_args(base)
                if args and len(args) >= 1:
                    return args[0]
        return None

    @classmethod
    def get_output_type(cls) -> type[BaseModel] | None:
        """Get the output Pydantic model type from Generic parameters."""
        for base in cls.__orig_bases__:  # type: ignore
            origin = get_origin(base)
            if origin is ActionPipeline:
                args = get_args(base)
                if args and len(args) >= 2:
                    return args[1]
        return None

    @classmethod
    def get_input_schema(cls) -> dict[str, Any]:
        """Get JSON schema for the input model."""
        input_type = cls.get_input_type()
        if input_type is None:
            return {}
        return input_type.model_json_schema()

    @classmethod
    def get_output_schema(cls) -> dict[str, Any]:
        """Get JSON schema for the output model."""
        output_type = cls.get_output_type()
        if output_type is None:
            return {}
        return output_type.model_json_schema()

