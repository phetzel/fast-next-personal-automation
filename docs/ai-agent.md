# AI Agent Documentation

The AI agent is built with [PydanticAI](https://ai.pydantic.dev/), providing type-safe AI agents with tool support.

## Overview

The agent architecture supports both general-purpose assistants and area-specific agents with filtered pipelines and CRUD toolsets:

```
WebSocket Connection
        │
        ▼
   Agent Router (/ws/agent?area=jobs)
        │
        ▼
   AssistantAgent (with optional AreaAgentConfig)
        │
   ┌────┼────────────┐
   ▼    ▼            ▼
 Tools  Toolsets   LLM (OpenAI)
        (CRUD)
```

### General vs Area Agents

| Type | Access | Use Case |
|------|--------|----------|
| **General** | All pipelines, basic tools | General-purpose chat |
| **Area** (e.g., "jobs") | Filtered pipelines, area CRUD tools | Domain-specific tasks |

## Configuration

Set in your `.env` file:

```env
# Required
OPENAI_API_KEY=sk-your-key

# Optional
AI_MODEL=gpt-4o-mini        # Model to use
AI_TEMPERATURE=0.7          # Response creativity (0-1)
```

## Agent Implementation

### AssistantAgent Class

Located in `backend/app/agents/assistant.py`:

```python
from pydantic_ai import Agent, RunContext
from dataclasses import dataclass

@dataclass
class Deps:
    """Dependencies available to tools via RunContext."""
    user_id: str | None = None
    user_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

class AssistantAgent:
    def __init__(
        self,
        model_name: str = "gpt-4o-mini",
        temperature: float = 0.7,
        system_prompt: str = "You are a helpful assistant.",
    ):
        self.agent = Agent[Deps, str](...)
    
    async def run(self, user_input, history, deps) -> tuple[str, list, Deps]:
        """Single response mode."""
        result = await self.agent.run(user_input, deps=deps, ...)
        return result.output, tool_events, deps
    
    async def iter(self, user_input, history, deps):
        """Streaming mode - yields events."""
        async with self.agent.iter(...) as run:
            async for event in run:
                yield event
```

### Using the Agent

```python
from app.agents.assistant import get_agent, Deps

agent = get_agent()

# Single response
output, tools, deps = await agent.run(
    user_input="What time is it?",
    history=[],
    deps=Deps(user_id="123"),
)

# Streaming
async for event in agent.iter("Tell me a story", history=[]):
    if isinstance(event, PartDeltaEvent):
        print(event.delta, end="")
```

## Area Agents

Area agents are specialized assistants with access to filtered pipelines and domain-specific CRUD tools.

### Configuration

Area configurations are defined in `backend/app/agents/areas.py`:

```python
from pydantic_ai import CombinedToolset
from app.agents.area_config import AreaAgentConfig
from app.agents.tools.jobs import jobs_toolset, job_profiles_toolset

JOBS_AGENT_CONFIG = AreaAgentConfig(
    area="jobs",
    system_prompt="""You are a specialized job search assistant...""",
    allowed_pipeline_tags=["jobs"],  # Only pipelines tagged with "jobs"
    toolsets=[
        CombinedToolset([
            jobs_toolset.prefixed("jobs"),       # jobs_list_jobs, jobs_get_job, etc.
            job_profiles_toolset.prefixed("profiles"),  # profiles_list_profiles, etc.
        ])
    ],
)
```

### Using Area Agents

```python
from app.agents.assistant import get_agent_for_area, Deps

# Get jobs area agent
agent = get_agent_for_area("jobs")

# Agent has access to:
# - Pipelines tagged with "jobs" (via run_pipeline tool)
# - Jobs CRUD tools (list_jobs, get_job, update_job_status, etc.)
# - Profile CRUD tools (list_profiles, create_profile, etc.)

output, tools, deps = await agent.run(
    user_input="Show me my high-scoring jobs",
    history=[],
    deps=Deps(user_id="123", db=db_session),
)
```

### Available Area Toolsets

**Jobs Area (`jobs`):**

| Toolset | Tools | Description |
|---------|-------|-------------|
| `jobs_*` | `list_jobs`, `get_job`, `update_job_status`, `get_job_stats`, `delete_job` | Manage saved job listings |
| `profiles_*` | `list_profiles`, `get_profile`, `get_default_profile`, `create_profile` | Manage job search profiles |

## Adding Custom Tools

Tools are functions the AI can call. Add them in `backend/app/agents/tools/`:

### 1. Create the Tool Function

```python
# app/agents/tools/weather.py
import httpx

async def get_weather(city: str) -> str:
    """Get current weather for a city."""
    # Make API call to weather service
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.weather.com/v1/current",
            params={"city": city}
        )
        data = response.json()
    return f"Weather in {city}: {data['temperature']}°C, {data['conditions']}"
```

### 2. Register the Tool

```python
# app/agents/assistant.py
class AssistantAgent:
    def _register_tools(self, agent: Agent[Deps, str]) -> None:
        @agent.tool
        async def current_datetime(ctx: RunContext[Deps]) -> str:
            """Get the current date and time."""
            return get_current_datetime()
        
        @agent.tool
        async def get_weather(ctx: RunContext[Deps], city: str) -> str:
            """Get current weather for a city.
            
            Args:
                city: The city name to get weather for.
            """
            from app.agents.tools.weather import get_weather as _get_weather
            return await _get_weather(city)
```

### 3. Tool with Database Access

```python
@agent.tool
async def search_user_items(ctx: RunContext[Deps], query: str) -> list[dict]:
    """Search items owned by the current user.
    
    Args:
        query: Search query string.
    """
    if not ctx.deps.user_id:
        return []
    
    async with get_db_context() as db:
        items = await item_repo.search(
            db, 
            user_id=ctx.deps.user_id,
            query=query
        )
    return [{"name": i.name, "id": str(i.id)} for i in items]
```

## Adding Area Toolsets

For areas that need CRUD operations, create toolsets using PydanticAI's `FunctionToolset`.

### 1. Create Toolset Module

```python
# app/agents/tools/myarea/myentity_tools.py
from uuid import UUID
from pydantic_ai import RunContext
from pydantic_ai.toolsets import FunctionToolset

from app.repositories import myentity as myentity_repo

myentity_toolset = FunctionToolset()

@myentity_toolset.tool
async def list_entities(ctx: RunContext, page: int = 1) -> dict:
    """List entities for the current user.
    
    Args:
        page: Page number (starts at 1)
    
    Returns:
        List of entities with pagination info
    """
    if not ctx.deps.db or not ctx.deps.user_id:
        return {"success": False, "error": "Not authenticated"}
    
    user_id = UUID(ctx.deps.user_id)
    entities = await myentity_repo.get_by_user(ctx.deps.db, user_id)
    
    return {
        "success": True,
        "entities": [e.model_dump() for e in entities],
    }
```

### 2. Export from Module

```python
# app/agents/tools/myarea/__init__.py
from app.agents.tools.myarea.myentity_tools import myentity_toolset

__all__ = ["myentity_toolset"]
```

### 3. Add to Area Config

```python
# app/agents/areas.py
from app.agents.tools.myarea import myentity_toolset

MYAREA_AGENT_CONFIG = AreaAgentConfig(
    area="myarea",
    system_prompt="You are a myarea assistant...",
    allowed_pipeline_tags=["myarea"],
    toolsets=[myentity_toolset.prefixed("myarea")],
)

AREA_CONFIGS["myarea"] = MYAREA_AGENT_CONFIG
```

## WebSocket Events

The agent WebSocket sends various event types:

### Events from Server

| Event | Data | Description |
|-------|------|-------------|
| `conversation_created` | `{conversation_id}` | New conversation started |
| `model_request_start` | `{}` | AI is generating response |
| `text_delta` | `{content, index}` | Streaming text chunk |
| `tool_call` | `{tool_name, args, tool_call_id}` | Tool invocation |
| `tool_result` | `{tool_call_id, content}` | Tool returned |
| `final_result` | `{content}` | Response complete |
| `error` | `{message}` | Error occurred |

### Events to Server

```json
{
  "message": "User's message text",
  "conversation_id": "optional-uuid"
}
```

## Frontend Integration

### useChat Hook

```typescript
const { messages, isConnected, sendMessage } = useChat({
  conversationId: currentConversationId,
  onConversationCreated: (id) => {
    // Handle new conversation
  },
});

// Handle incoming events
switch (wsEvent.type) {
  case "text_delta":
    // Append to current message
    break;
  case "tool_call":
    // Show tool call card
    break;
  case "tool_result":
    // Update tool call with result
    break;
}
```

### ToolCallCard Component

Displays tool invocations in the UI:

```tsx
<ToolCallCard toolCall={{
  id: "call-123",
  name: "get_weather",
  args: { city: "London" },
  result: "Weather in London: 15°C, Cloudy",
  status: "completed"
}} />
```

## Conversation Persistence

Conversations are automatically saved to the database:

```python
# In agent.py WebSocket handler
async with get_db_context() as db:
    conv_service = get_conversation_service(db)
    
    # Save user message
    await conv_service.add_message(
        conversation_id,
        MessageCreate(role="user", content=user_message)
    )
    
    # Save assistant response
    await conv_service.add_message(
        conversation_id,
        MessageCreate(
            role="assistant",
            content=response_text,
            model_name="gpt-4o-mini"
        )
    )
```

## Testing the Agent

```python
# tests/test_agents.py
import pytest
from app.agents.assistant import get_agent, Deps

@pytest.mark.asyncio
async def test_agent_responds():
    agent = get_agent()
    output, tools, deps = await agent.run(
        "What is 2 + 2?",
        history=[],
        deps=Deps(),
    )
    assert "4" in output

@pytest.mark.asyncio
async def test_agent_uses_tool():
    agent = get_agent()
    output, tools, deps = await agent.run(
        "What time is it?",
        history=[],
        deps=Deps(),
    )
    assert len(tools) > 0
    assert tools[0].tool_name == "current_datetime"
```

## Observability

With Logfire enabled, you can trace:

- Agent runs and responses
- Tool calls and results
- Token usage
- Latency metrics

```python
# Automatic instrumentation in main.py
from app.core.logfire_setup import instrument_pydantic_ai
instrument_pydantic_ai()
```

View traces in the Logfire dashboard at https://logfire.pydantic.dev.

