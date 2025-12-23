"""AI Agent WebSocket routes with streaming support (PydanticAI)."""

import json
import logging
from datetime import datetime, UTC
from typing import Any
from uuid import UUID

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect
from pydantic_ai import (
    Agent,
    FinalResultEvent,
    FunctionToolCallEvent,
    FunctionToolResultEvent,
    PartDeltaEvent,
    PartStartEvent,
    TextPartDelta,
    ToolCallPartDelta,
)
from pydantic_ai.messages import (
    ModelRequest,
    ModelResponse,
    SystemPromptPart,
    TextPart,
    UserPromptPart,
)

from app.agents.assistant import Deps, get_agent
from app.api.deps import get_conversation_service, get_optional_user_ws
from app.db.models.user import User
from app.db.session import get_db_context
from app.schemas.conversation import (
    ConversationCreate,
    MessageCreate,
    ToolCallCreate,
    ToolCallComplete,
)

logger = logging.getLogger(__name__)

router = APIRouter()


class AgentConnectionManager:
    """WebSocket connection manager for AI agent."""

    def __init__(self) -> None:
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket) -> None:
        """Accept and store a new WebSocket connection."""
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Agent WebSocket connected. Total connections: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove a WebSocket connection."""
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(
            f"Agent WebSocket disconnected. Total connections: {len(self.active_connections)}"
        )

    async def send_event(self, websocket: WebSocket, event_type: str, data: Any) -> bool:
        """Send a JSON event to a specific WebSocket client.

        Returns True if sent successfully, False if connection is closed.
        """
        try:
            await websocket.send_json({"type": event_type, "data": data})
            return True
        except (WebSocketDisconnect, RuntimeError):
            # Connection already closed
            return False


manager = AgentConnectionManager()


def build_message_history(history: list[dict[str, str]]) -> list[ModelRequest | ModelResponse]:
    """Convert conversation history to PydanticAI message format."""
    model_history: list[ModelRequest | ModelResponse] = []

    for msg in history:
        if msg["role"] == "user":
            model_history.append(ModelRequest(parts=[UserPromptPart(content=msg["content"])]))
        elif msg["role"] == "assistant":
            model_history.append(ModelResponse(parts=[TextPart(content=msg["content"])]))
        elif msg["role"] == "system":
            model_history.append(ModelRequest(parts=[SystemPromptPart(content=msg["content"])]))

    return model_history


@router.websocket("/ws/agent")
async def agent_websocket(
    websocket: WebSocket,
    user: User | None = Depends(get_optional_user_ws),
) -> None:
    """WebSocket endpoint for AI agent with full event streaming.

    Uses PydanticAI iter() to stream all agent events including:
    - user_prompt: When user input is received
    - model_request_start: When model request begins
    - text_delta: Streaming text from the model
    - tool_call_delta: Streaming tool call arguments
    - tool_call: When a tool is called (with full args)
    - tool_result: When a tool returns a result
    - final_result: When the final result is ready
    - complete: When processing is complete
    - error: When an error occurs

    Expected input message format:
    {
        "message": "user message here",
        "history": [{"role": "user|assistant|system", "content": "..."}],
        "conversation_id": "optional-uuid-to-continue-existing-conversation"
    }

    Authentication: Optional. Pass JWT token as query parameter for persistence.
    Anonymous users can chat but conversations are not saved to the database.

    Persistence: Set 'conversation_id' to continue an existing conversation.
    If not provided and user is authenticated, a new conversation is created.
    The conversation_id is returned in the 'conversation_started' event.
    """

    await manager.connect(websocket)

    # Conversation state per connection
    conversation_history: list[dict[str, str]] = []
    deps = Deps()
    current_conversation_id: str | None = None

    try:
        while True:
            # Receive user message
            data = await websocket.receive_json()
            user_message = data.get("message", "")
            # Optionally accept history from client (or use server-side tracking)
            if "history" in data:
                conversation_history = data["history"]

            if not user_message:
                await manager.send_event(websocket, "error", {"message": "Empty message"})
                continue

            # Handle conversation persistence (only for authenticated users)
            new_conversation_created = False
            if user is not None:
                try:
                    async with get_db_context() as db:
                        conv_service = get_conversation_service(db)

                        # Determine which conversation to use
                        # - If "conversation_id" key is present with a value: use that conversation
                        # - If "conversation_id" key is present with null: create new conversation
                        # - If "conversation_id" key is absent: continue current or create new
                        if "conversation_id" in data:
                            requested_conv_id = data["conversation_id"]
                            if requested_conv_id:
                                # Client wants to continue a specific conversation
                                current_conversation_id = requested_conv_id
                                # Verify conversation exists
                                await conv_service.get_conversation(UUID(requested_conv_id))
                            else:
                                # Client explicitly wants a new conversation (sent null)
                                current_conversation_id = None
                                # Also clear conversation history for new chat
                                conversation_history = []

                        # Create new conversation if needed
                        if not current_conversation_id:
                            conv_data = ConversationCreate(
                                user_id=user.id,
                                title=user_message[:50] if len(user_message) > 50 else user_message,
                            )
                            conversation = await conv_service.create_conversation(conv_data)
                            current_conversation_id = str(conversation.id)
                            new_conversation_created = True

                        # Save user message
                        await conv_service.add_message(
                            UUID(current_conversation_id),
                            MessageCreate(role="user", content=user_message),
                        )

                    # Transaction is now committed - safe to notify frontend
                    if new_conversation_created:
                        await manager.send_event(
                            websocket,
                            "conversation_created",
                            {"conversation_id": current_conversation_id},
                        )
                except Exception as e:
                    logger.warning(f"Failed to persist conversation: {e}")
                    # Continue without persistence

            await manager.send_event(websocket, "user_prompt", {"content": user_message})

            # Track tool calls for this message
            pending_tool_calls: dict[str, dict[str, Any]] = {}

            try:
                assistant = get_agent()
                model_history = build_message_history(conversation_history)

                # Use iter() on the underlying PydanticAI agent to stream all events
                async with assistant.agent.iter(
                    user_message,
                    deps=deps,
                    message_history=model_history,
                ) as agent_run:
                    async for node in agent_run:
                        if Agent.is_user_prompt_node(node):
                            await manager.send_event(
                                websocket,
                                "user_prompt_processed",
                                {"prompt": node.user_prompt},
                            )

                        elif Agent.is_model_request_node(node):
                            await manager.send_event(websocket, "model_request_start", {})

                            async with node.stream(agent_run.ctx) as request_stream:
                                async for event in request_stream:
                                    if isinstance(event, PartStartEvent):
                                        await manager.send_event(
                                            websocket,
                                            "part_start",
                                            {
                                                "index": event.index,
                                                "part_type": type(event.part).__name__,
                                            },
                                        )
                                        # Send initial content from TextPart if present
                                        if isinstance(event.part, TextPart) and event.part.content:
                                            await manager.send_event(
                                                websocket,
                                                "text_delta",
                                                {
                                                    "index": event.index,
                                                    "content": event.part.content,
                                                },
                                            )

                                    elif isinstance(event, PartDeltaEvent):
                                        if isinstance(event.delta, TextPartDelta):
                                            await manager.send_event(
                                                websocket,
                                                "text_delta",
                                                {
                                                    "index": event.index,
                                                    "content": event.delta.content_delta,
                                                },
                                            )
                                        elif isinstance(event.delta, ToolCallPartDelta):
                                            await manager.send_event(
                                                websocket,
                                                "tool_call_delta",
                                                {
                                                    "index": event.index,
                                                    "args_delta": event.delta.args_delta,
                                                },
                                            )

                                    elif isinstance(event, FinalResultEvent):
                                        await manager.send_event(
                                            websocket,
                                            "final_result_start",
                                            {"tool_name": event.tool_name},
                                        )

                        elif Agent.is_call_tools_node(node):
                            await manager.send_event(websocket, "call_tools_start", {})

                            async with node.stream(agent_run.ctx) as handle_stream:
                                async for event in handle_stream:
                                    if isinstance(event, FunctionToolCallEvent):
                                        # Track tool call for persistence
                                        # args comes as JSON string from PydanticAI, parse to dict
                                        args_dict = json.loads(event.part.args) if isinstance(event.part.args, str) else event.part.args
                                        pending_tool_calls[event.part.tool_call_id] = {
                                            "tool_name": event.part.tool_name,
                                            "args": args_dict,
                                            "started_at": datetime.now(UTC),
                                        }
                                        await manager.send_event(
                                            websocket,
                                            "tool_call",
                                            {
                                                "tool_name": event.part.tool_name,
                                                "args": event.part.args,
                                                "tool_call_id": event.part.tool_call_id,
                                            },
                                        )

                                    elif isinstance(event, FunctionToolResultEvent):
                                        # Update tool call with result
                                        if event.tool_call_id in pending_tool_calls:
                                            pending_tool_calls[event.tool_call_id]["result"] = str(event.result.content)
                                            pending_tool_calls[event.tool_call_id]["completed_at"] = datetime.now(UTC)
                                        await manager.send_event(
                                            websocket,
                                            "tool_result",
                                            {
                                                "tool_call_id": event.tool_call_id,
                                                "content": str(event.result.content),
                                            },
                                        )

                        elif Agent.is_end_node(node) and agent_run.result is not None:
                            await manager.send_event(
                                websocket,
                                "final_result",
                                {"output": agent_run.result.output},
                            )

                # Update conversation history
                conversation_history.append({"role": "user", "content": user_message})
                if agent_run.result:
                    conversation_history.append(
                        {"role": "assistant", "content": agent_run.result.output}
                    )

                # Save assistant response and tool calls to database
                if current_conversation_id and agent_run.result:
                    try:
                        async with get_db_context() as db:
                            conv_service = get_conversation_service(db)
                            # Create assistant message
                            assistant_message = await conv_service.add_message(
                                UUID(current_conversation_id),
                                MessageCreate(
                                    role="assistant",
                                    content=agent_run.result.output,
                                    model_name=assistant.model_name
                                    if hasattr(assistant, "model_name")
                                    else None,
                                ),
                            )
                            # Save tool calls associated with this message
                            for tool_call_id, tc_data in pending_tool_calls.items():
                                tool_call = await conv_service.start_tool_call(
                                    assistant_message.id,
                                    ToolCallCreate(
                                        tool_call_id=tool_call_id,
                                        tool_name=tc_data["tool_name"],
                                        args=tc_data.get("args", {}),
                                        started_at=tc_data.get("started_at"),
                                    ),
                                )
                                # Complete the tool call if we have a result
                                if "result" in tc_data:
                                    await conv_service.complete_tool_call(
                                        tool_call.id,
                                        ToolCallComplete(
                                            result=tc_data["result"],
                                            completed_at=tc_data.get("completed_at"),
                                            success=True,
                                        ),
                                    )
                    except Exception as e:
                        logger.exception(f"Failed to persist assistant response: {e}")

                await manager.send_event(
                    websocket,
                    "complete",
                    {
                        "conversation_id": current_conversation_id,
                    },
                )

            except WebSocketDisconnect:
                # Client disconnected during processing - this is normal
                logger.info("Client disconnected during agent processing")
                break
            except Exception as e:
                logger.exception(f"Error processing agent request: {e}")
                # Try to send error, but don't fail if connection is closed
                await manager.send_event(websocket, "error", {"message": str(e)})

    except WebSocketDisconnect:
        pass  # Normal disconnect
    finally:
        manager.disconnect(websocket)
