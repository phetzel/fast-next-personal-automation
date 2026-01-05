# Architecture

This document describes the system architecture and design patterns used in the project.

## Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js 15)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │   Pages     │  │  Components │  │   Hooks     │  │   Stores    │ │
│  │  (App Router)│  │  (React)    │  │ (useChat)   │  │  (Zustand)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘ │
└────────────────────────────┬──────────────────┬─────────────────────┘
                             │ HTTP/REST        │ WebSocket
                             ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         Backend (FastAPI)                            │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                        API Routes (v1)                           ││
│  │  /auth  /users  /conversations  /webhooks  /ws/agent            ││
│  └─────────────────────────────────────────────────────────────────┘│
│                             │                                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                         Services                                 ││
│  │  UserService  ConversationService  WebhookService  etc.         ││
│  └─────────────────────────────────────────────────────────────────┘│
│                             │                                        │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │                       Repositories                               ││
│  │  user_repo  conversation_repo  webhook_repo  etc.               ││
│  └─────────────────────────────────────────────────────────────────┘│
│                             │                                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │  PostgreSQL   │  │     Redis     │  │   AI Agent    │           │
│  │   (asyncpg)   │  │   (caching)   │  │  (PydanticAI) │           │
│  └───────────────┘  └───────────────┘  └───────┬───────┘           │
└─────────────────────────────────────────────────┼───────────────────┘
                                                  │
                                                  ▼
                                          ┌───────────────┐
                                          │  OpenAI API   │
                                          │ (or other LLM)│
                                          └───────────────┘
```

## Backend Architecture

### Layered Pattern

The backend follows a clean **Repository + Service** pattern with base class inheritance:

```
API Routes → Services → Repositories → Database
                ↓
           AI Agents → External LLM APIs
```

| Layer | Responsibility |
|-------|----------------|
| **Routes** | HTTP handling, request validation, authentication |
| **Services** | Business logic, orchestration, domain rules |
| **Repositories** | Data access, SQL queries, database operations |

### Base Class Hierarchy

**Repositories** extend from a hierarchy of base classes:

```
BaseRepository[ModelType]           # Generic CRUD (get, create, update, delete)
    └── UserOwnedRepository         # + get_by_user_id, ownership scoping
        └── PrimaryEntityRepository # + set_primary, get_primary_for_user
```

**Services** extend from corresponding base classes:

```
BaseService[ModelType, RepoType]     # get_by_id_for_user (ownership check)
    └── PrimaryEntityService         # + set_primary, delete_with_reassignment
```

This eliminates boilerplate while preserving type safety.

### Example Flow: User Registration

```python
# 1. Route (app/api/routes/v1/auth.py)
@router.post("/register")
async def register(user_in: UserCreate, user_service: UserSvc):
    user = await user_service.register(user_in)
    return user

# 2. Service (app/services/user.py)
async def register(self, user_in: UserCreate) -> User:
    existing = await user_repo.get_by_email(self.db, user_in.email)
    if existing:
        raise AlreadyExistsError(message="Email already registered")
    hashed_password = get_password_hash(user_in.password)
    return await user_repo.create(self.db, email=user_in.email, ...)

# 3. Repository (app/repositories/user.py)
async def create(db: AsyncSession, *, email: str, hashed_password: str, ...) -> User:
    user = User(email=email, hashed_password=hashed_password, ...)
    db.add(user)
    await db.flush()
    return user
```

### Dependency Injection

FastAPI's dependency injection is used throughout:

```python
# app/api/deps.py
DBSession = Annotated[AsyncSession, Depends(get_db_session)]
UserSvc = Annotated[UserService, Depends(get_user_service)]

# Usage in routes
@router.get("/users/{user_id}")
async def get_user(user_id: UUID, user_service: UserSvc):
    return await user_service.get_by_id(user_id)
```

## Database Models

### Core Models

| Model | Purpose |
|-------|---------|
| `User` | User accounts with roles, OAuth links |
| `Session` | Active login sessions (refresh tokens) |
| `Conversation` | Chat conversation groups |
| `Message` | Individual chat messages |
| `ToolCall` | AI tool invocation records |
| `Webhook` | Webhook subscriptions |
| `WebhookDelivery` | Webhook delivery logs |
| `Job` | Job listings |
| `JobProfile` | User job preferences |
| `Resume` | Uploaded resumes |
| `EmailSource` | Connected email accounts |

### Relationships

```
User
 ├── Sessions (1:N)
 ├── Conversations (1:N)
 │    └── Messages (1:N)
 │         └── ToolCalls (1:N)
 ├── Webhooks (1:N)
 │    └── WebhookDeliveries (1:N)
 ├── JobProfiles (1:N)
 │    └── Resume (N:1, optional)
 ├── Resumes (1:N)
 └── Jobs (1:N)
```

### Jobs Area Models

| Model | Purpose |
|-------|---------|
| `JobProfile` | Job search configuration (target roles, locations, preferences) |
| `Resume` | Uploaded resume files with extracted text |
| `Job` | Scraped job listings with AI analysis scores |

## Frontend Architecture

### State Management (Zustand)

| Store | Purpose |
|-------|---------|
| `auth-store` | User auth state, tokens |
| `chat-store` | Current messages, streaming |
| `conversation-store` | Conversation list, selection |
| `theme-store` | Dark/light mode |
| `sidebar-store` | Sidebar collapse state |

### Component Hierarchy

```
App (layout.tsx)
 ├── Header
 │    ├── ThemeToggle
 │    └── UserMenu
 ├── Sidebar
 │    └── ConversationSidebar
 └── Page Content
      └── ChatContainer
           ├── MessageList
           │    └── MessageItem
           │         ├── MarkdownContent
           │         └── ToolCallCard
           └── ChatInput
```

### Custom Hooks

| Hook | Purpose |
|------|---------|
| `useAuth` | Login, logout, register, token refresh |
| `useChat` | WebSocket chat with persistence |
| `useLocalChat` | Local-only chat (anonymous users) |
| `useWebSocket` | Generic WebSocket connection |
| `useConversations` | Fetch/manage conversation history |
| `useJobProfiles` | Job profile CRUD operations |
| `useResumes` | Resume upload and management (via `useCrud`) |
| `useStories` | Career story management (via `useCrud`) |
| `useProjects` | Project management (via `useCrud`) |
| `usePipelines` | Pipeline list with area filtering |
| `useCrud` | Generic CRUD hook factory |

### Hook Factories

The frontend uses factory functions to reduce duplication:

```
useCrud<T, TSummary, TCreate, TUpdate>()      // Basic CRUD operations
usePrimaryCrud<T, TSummary, TCreate, TUpdate>() // + primary/default management
```

Example usage:
```typescript
const { items, createItem, updateItem, deleteItem, setPrimary } = usePrimaryCrud({
  basePath: "/resumes",
  itemName: "resume",
});

## AI Agent Architecture

### PydanticAI Agent

```python
# app/agents/assistant.py
@dataclass
class Deps:
    user_id: str | None = None
    user_name: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)

class AssistantAgent:
    def __init__(self, model_name, temperature, system_prompt, area_config=None):
        self.agent = Agent[Deps, str](...)
        self.area_config = area_config  # Optional area-specific config
    
    async def iter(self, user_input, history, deps):
        async with self.agent.iter(...) as run:
            async for event in run:
                yield event  # Stream to WebSocket
```

### Area-Specific Agents

Agents can be scoped to specific areas (like "jobs") with filtered pipeline access:

```python
# app/agents/area_config.py
@dataclass
class AreaAgentConfig:
    area: str  # e.g., "jobs"
    system_prompt: str  # Custom prompt for this area
    allowed_pipeline_tags: list[str] | None = None
    allowed_pipelines: list[str] | None = None

# Get a jobs-specific agent
from app.agents.assistant import get_agent_for_area
jobs_agent = get_agent_for_area("jobs")
```

### Pipeline Tagging

Pipelines can be tagged with areas for filtering:

```python
@register_pipeline
class JobSearchPipeline(ActionPipeline[...]):
    name = "job_search"
    tags = ["jobs", "scraping", "ai"]
    area = "jobs"  # Primary area association
```

### WebSocket Events

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `model_request_start` | Server→Client | New AI response starting |
| `text_delta` | Server→Client | Streamed text chunk |
| `tool_call` | Server→Client | Tool invocation started |
| `tool_result` | Server→Client | Tool returned result |
| `final_result` | Server→Client | Response complete |
| `error` | Server→Client | Error occurred |

## Security

### Authentication Flow

```
1. User submits credentials (email/password)
2. Backend validates, creates JWT access token (30min) + refresh token (7 days)
3. Frontend stores tokens, sends access token with requests
4. On 401, frontend uses refresh token to get new access token
5. Logout invalidates refresh token session
```

### Token Types

| Token | Lifetime | Purpose |
|-------|----------|---------|
| Access Token | 30 minutes | API authentication |
| Refresh Token | 7 days | Obtain new access tokens |

### API Key Authentication

For service-to-service calls:
```http
X-API-Key: your-api-key
```

## Observability

### Logfire Integration

Instrumented components:
- FastAPI routes (request/response tracing)
- AsyncPG (database queries)
- Redis (cache operations)
- HTTPX (external HTTP calls)
- PydanticAI (agent runs, tool calls)

### Logging

Structured logging with contextual information:
```python
logger.info(f"Running agent with user input: {user_input[:100]}...")
```

