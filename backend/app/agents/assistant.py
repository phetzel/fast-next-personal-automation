"""Assistant agent with PydanticAI.

The main conversational agent that can be extended with custom tools.
"""

import logging
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID

from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextPart,
    UserPromptPart,
)
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider
from pydantic_ai.settings import ModelSettings

from app.agents.tools import get_current_datetime
from app.core.config import settings
from app.pipelines.action_base import PipelineContext, PipelineSource
from app.pipelines.registry import execute_pipeline, list_pipelines

logger = logging.getLogger(__name__)


@dataclass
class Deps:
    """Dependencies for the assistant agent.

    These are passed to tools via RunContext.
    """

    user_id: str | None = None
    user_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)
    # Database session for pipeline run tracking (optional)
    db: Any = None  # AsyncSession, but using Any to avoid circular imports


class AssistantAgent:
    """Assistant agent wrapper for conversational AI.

    Encapsulates agent creation and execution with tool support.
    """

    def __init__(
        self,
        model_name: str | None = None,
        temperature: float | None = None,
        system_prompt: str = "You are a helpful assistant.",
    ):
        self.model_name = model_name or settings.AI_MODEL
        self.temperature = temperature or settings.AI_TEMPERATURE
        self.system_prompt = system_prompt
        self._agent: Agent[Deps, str] | None = None

    def _create_agent(self) -> Agent[Deps, str]:
        """Create and configure the PydanticAI agent."""
        model = OpenAIChatModel(
            self.model_name,
            provider=OpenAIProvider(api_key=settings.OPENAI_API_KEY),
        )

        agent = Agent[Deps, str](
            model=model,
            model_settings=ModelSettings(temperature=self.temperature),
            system_prompt=self.system_prompt,
        )

        self._register_tools(agent)

        return agent

    def _register_tools(self, agent: Agent[Deps, str]) -> None:
        """Register all tools on the agent."""

        @agent.tool
        async def current_datetime(ctx: RunContext[Deps]) -> str:
            """Get the current date and time.

            Use this tool when you need to know the current date or time.
            """
            return get_current_datetime()

        @agent.tool
        async def list_available_pipelines(ctx: RunContext[Deps]) -> list[dict[str, Any]]:
            """List all available automation pipelines.

            Use this tool to discover what automations are available before running them.
            Returns a list of pipelines with their names, descriptions, and input schemas.
            """
            pipelines = list_pipelines()
            # Return simplified info for the LLM
            return [
                {
                    "name": p["name"],
                    "description": p["description"],
                    "input_schema": p["input_schema"],
                }
                for p in pipelines
            ]

        @agent.tool
        async def run_pipeline(
            ctx: RunContext[Deps],
            pipeline_name: str,
            input_data: dict[str, Any] | None = None,
        ) -> dict[str, Any]:
            """Execute an automation pipeline by name.

            IMPORTANT: You must provide BOTH pipeline_name AND input_data.
            The input_data must be a dictionary containing the required fields
            from the pipeline's input_schema.

            Example for the 'echo' pipeline:
                pipeline_name: "echo"
                input_data: {"message": "Hello world", "uppercase": true}

            Args:
                pipeline_name: The name of the pipeline to execute (e.g., "echo").
                input_data: A dictionary with the pipeline's required input fields.
                    For echo: {"message": "text to echo", "uppercase": false}

            Returns:
                A dictionary with success status, output data, and any error messages.
            """
            # Validate input_data is provided
            if input_data is None:
                return {
                    "success": False,
                    "output": None,
                    "error": f"Missing input_data. You must provide input_data with the required fields for the '{pipeline_name}' pipeline. Use list_available_pipelines to see the required input schema.",
                }

            # Build context from agent deps
            user_id = None
            if ctx.deps.user_id:
                try:
                    user_id = UUID(ctx.deps.user_id)
                except ValueError:
                    pass

            context = PipelineContext(
                source=PipelineSource.AGENT,
                user_id=user_id,
                metadata=ctx.deps.metadata,
            )

            try:
                result = await execute_pipeline(
                    pipeline_name,
                    input_data,
                    context,
                    db=ctx.deps.db,  # Pass db for run tracking
                )
                return {
                    "success": result.success,
                    "output": result.output.model_dump() if result.output else None,
                    "error": result.error,
                }
            except Exception as e:
                return {
                    "success": False,
                    "output": None,
                    "error": str(e),
                }

    @property
    def agent(self) -> Agent[Deps, str]:
        """Get or create the agent instance."""
        if self._agent is None:
            self._agent = self._create_agent()
        return self._agent

    async def run(
        self,
        user_input: str,
        history: list[dict[str, str]] | None = None,
        deps: Deps | None = None,
    ) -> tuple[str, list[Any], Deps]:
        """Run agent and return the output along with tool call events.

        Args:
            user_input: User's message.
            history: Conversation history as list of {"role": "...", "content": "..."}.
            deps: Optional dependencies. If not provided, a new Deps will be created.

        Returns:
            Tuple of (output_text, tool_events, deps).
        """
        model_history: list[ModelRequest | ModelResponse] = []

        for msg in history or []:
            if msg["role"] == "user":
                model_history.append(ModelRequest(parts=[UserPromptPart(content=msg["content"])]))
            elif msg["role"] == "assistant":
                model_history.append(ModelResponse(parts=[TextPart(content=msg["content"])]))
            elif msg["role"] == "system":
                model_history.append(ModelRequest(parts=[SystemPromptPart(content=msg["content"])]))

        agent_deps = deps if deps is not None else Deps()

        logger.info(f"Running agent with user input: {user_input[:100]}...")
        result = await self.agent.run(user_input, deps=agent_deps, message_history=model_history)

        tool_events: list[Any] = []
        for message in result.all_messages():
            if hasattr(message, "parts"):
                for part in message.parts:
                    if hasattr(part, "tool_name"):
                        tool_events.append(part)

        logger.info(f"Agent run complete. Output length: {len(result.output)} chars")

        return result.output, tool_events, agent_deps

    async def iter(
        self,
        user_input: str,
        history: list[dict[str, str]] | None = None,
        deps: Deps | None = None,
    ):
        """Stream agent execution with full event access.

        Args:
            user_input: User's message.
            history: Conversation history.
            deps: Optional dependencies.

        Yields:
            Agent events for streaming responses.
        """
        model_history: list[ModelRequest | ModelResponse] = []

        for msg in history or []:
            if msg["role"] == "user":
                model_history.append(ModelRequest(parts=[UserPromptPart(content=msg["content"])]))
            elif msg["role"] == "assistant":
                model_history.append(ModelResponse(parts=[TextPart(content=msg["content"])]))
            elif msg["role"] == "system":
                model_history.append(ModelRequest(parts=[SystemPromptPart(content=msg["content"])]))

        agent_deps = deps if deps is not None else Deps()

        async with self.agent.iter(
            user_input,
            deps=agent_deps,
            message_history=model_history,
        ) as run:
            async for event in run:
                yield event


def get_agent() -> AssistantAgent:
    """Factory function to create an AssistantAgent.

    Returns:
        Configured AssistantAgent instance.
    """
    return AssistantAgent()


async def run_agent(
    user_input: str,
    history: list[dict[str, str]],
    deps: Deps | None = None,
) -> tuple[str, list[Any], Deps]:
    """Run agent and return the output along with tool call events.

    This is a convenience function for backwards compatibility.

    Args:
        user_input: User's message.
        history: Conversation history.
        deps: Optional dependencies.

    Returns:
        Tuple of (output_text, tool_events, deps).
    """
    agent = get_agent()
    return await agent.run(user_input, history, deps)
