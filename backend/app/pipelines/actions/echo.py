"""Echo pipeline - example action pipeline.

A simple pipeline that echoes input back, useful for:
- Testing all entry points (API, webhook, agent)
- Demonstrating the pipeline pattern
- Verifying the system is working
"""

from pydantic import BaseModel, Field

from app.pipelines.action_base import ActionPipeline, ActionResult, PipelineContext
from app.pipelines.registry import register_pipeline


class EchoInput(BaseModel):
    """Input for the echo pipeline."""

    message: str = Field(..., description="The message to echo back")
    uppercase: bool = Field(
        default=False,
        description="Whether to convert the message to uppercase",
    )


class EchoOutput(BaseModel):
    """Output from the echo pipeline."""

    echo: str = Field(..., description="The echoed message")
    length: int = Field(..., description="Length of the original message")
    source: str = Field(..., description="How the pipeline was invoked")


@register_pipeline
class EchoPipeline(ActionPipeline[EchoInput, EchoOutput]):
    """Echo pipeline that returns the input message.

    This is a simple example pipeline that demonstrates:
    - Input/output type definitions with Pydantic
    - Pipeline registration
    - Context usage (shows invocation source)
    - Proper ActionResult construction
    """

    name = "echo"
    description = "Echo back the input message. Useful for testing pipeline connectivity."

    async def execute(
        self, input: EchoInput, context: PipelineContext
    ) -> ActionResult[EchoOutput]:
        """Execute the echo pipeline.

        Args:
            input: The echo input with message and options.
            context: Execution context with source info.

        Returns:
            ActionResult containing the echoed message.
        """
        # Process the message
        message = input.message
        if input.uppercase:
            message = message.upper()

        # Build output with context info
        output = EchoOutput(
            echo=message,
            length=len(input.message),
            source=context.source.value,
        )

        return ActionResult(
            success=True,
            output=output,
            metadata={
                "user_id": str(context.user_id) if context.user_id else None,
            },
        )

