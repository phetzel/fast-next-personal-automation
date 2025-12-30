# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**personal_automations** is a FastAPI application generated with [Full-Stack FastAPI + Next.js Template](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template).

**Stack:**
- FastAPI + Pydantic v2
- PostgreSQL (async with asyncpg + SQLAlchemy 2.0)
- JWT authentication (access + refresh tokens)
- Redis (caching, sessions)
- PydanticAI (AI agents with tool support)
- Taskiq (async background tasks)
- Next.js 15 + React 19 + TypeScript + Tailwind CSS v4

## Commands

### Backend

```bash
cd backend

# Install dependencies
uv sync

# Run development server
uv run uvicorn app.main:app --reload --port 8000

# Or use project CLI
uv run personal_automations server run --reload

# Run tests
pytest
pytest tests/test_file.py::test_name -v

# Linting and formatting
ruff check .
ruff check . --fix
ruff format .

# Type checking
mypy app
```

### Database

```bash
cd backend

# Run all migrations
uv run alembic upgrade head

# Create new migration
uv run alembic revision --autogenerate -m "Description"

# Or use project CLI
uv run personal_automations db upgrade
uv run personal_automations db migrate -m "Description"
```

### User Management

```bash
cd backend

# Create admin user
uv run personal_automations user create-admin --email admin@example.com

# List users
uv run personal_automations user list
```

### Frontend

```bash
cd frontend

# Install dependencies
bun install

# Run development server
bun dev

# Run tests
bun test
bun test:e2e
```

### Docker

```bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f

# Stop services
docker compose down
```

## Architecture

This project follows a **Repository + Service** layered architecture:

```
API Routes → Services → Repositories → Database
```

### Directory Structure (`backend/app/`)

| Directory | Purpose |
|-----------|---------|
| `api/routes/v1/` | HTTP endpoints, request validation, auth |
| `api/deps.py` | Dependency injection (db session, current user) |
| `services/` | Business logic, orchestration |
| `repositories/` | Data access layer, database queries |
| `schemas/` | Pydantic models for request/response |
| `db/models/` | SQLAlchemy/MongoDB models |
| `core/config.py` | Settings via pydantic-settings |
| `core/security.py` | JWT/API key utilities |
| `agents/` | PydanticAI agents and tools |
| `commands/` | Django-style CLI commands |
| `worker/` | Background task definitions |

### Adding New Features

**1. Add a new API endpoint:**
```
1. Create schema in `schemas/`
2. Create model in `db/models/` (if new entity)
3. Create repository in `repositories/`
4. Create service in `services/`
5. Create route in `api/routes/v1/`
6. Register route in `api/routes/v1/__init__.py`
```

**2. Add a custom CLI command:**
```python
# app/commands/my_command.py
from app.commands import command, success
import click

@command("my-command", help="Description")
@click.option("--option", "-o", help="Some option")
def my_command(option: str):
    # Logic here
    success(f"Done with {option}")
```
Commands are auto-discovered. Run with: `personal_automations cmd my-command`

**3. Add an AI agent tool (PydanticAI):**
```python
# app/agents/assistant.py
@agent.tool
async def my_tool(ctx: RunContext[Deps], param: str) -> dict:
    """Tool description for LLM."""
    # Tool logic
    return {"result": param}
```

## Key Patterns

### Dependency Injection

```python
# In routes
from app.api.deps import DBSession, CurrentUser, JobSvc

@router.get("/jobs")
async def list_jobs(
    db: DBSession,
    current_user: CurrentUser,
    job_service: JobSvc,
):
    return await job_service.get_by_user(current_user.id)
```

### Service Layer

```python
# Services contain business logic
class JobService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, user_id: UUID, job_in: JobCreate) -> Job:
        # Business validation
        # Repository calls
        return await job_repo.create(self.db, user_id=user_id, **job_in.model_dump())
```

### Repository Layer

```python
# Repositories handle data access only
class ItemRepository:
    async def get_by_id(self, db: AsyncSession, id: UUID) -> Item | None:
        return await db.get(Item, id)

    async def create(self, db: AsyncSession, **kwargs) -> Item:
        item = Item(**kwargs)
        db.add(item)
        await db.flush()
        await db.refresh(item)
        return item
```

### Custom Exceptions

```python
from app.core.exceptions import NotFoundError, AlreadyExistsError

# In services
if not item:
    raise NotFoundError(message="Item not found", details={"id": str(id)})
```

## Frontend Patterns

### Authentication

Tokens stored in HTTP-only cookies. Use the auth hook:

```typescript
import { useAuth } from '@/hooks/use-auth';

function Component() {
  const { user, isAuthenticated, login, logout } = useAuth();
}
```

### State Management (Zustand)

```typescript
import { useAuthStore } from '@/stores/auth-store';

const { user, setUser, logout } = useAuthStore();
```

### WebSocket Chat

```typescript
import { useChat } from '@/hooks/use-chat';

function ChatPage() {
  const { messages, sendMessage, isStreaming } = useChat();
}
```

## Environment Variables

Key variables in `.env`:

```bash
ENVIRONMENT=local  # local, staging, production
POSTGRES_HOST=localhost
POSTGRES_PASSWORD=secret
SECRET_KEY=change-me-use-openssl-rand-hex-32
OPENAI_API_KEY=sk-...
LOGFIRE_TOKEN=your-token
```

## Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=app --cov-report=term-missing

# Specific test
pytest tests/api/test_health.py -v

# Run only unit tests
pytest tests/unit/

# Run only integration tests
pytest tests/integration/
```

## Key Design Decisions
- Database operations are async
- Use `db.flush()` in repositories (not `commit`) - let the dependency manage transactions
- Services raise domain exceptions (`NotFoundError`, etc.) - routes convert to HTTP
- Schemas are separate for Create, Update, and Response
- AI Agent uses PydanticAI `iter()` for WebSocket streaming
- Custom commands auto-discovered from `app/commands/`

## Documentation

- [Template Repository](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template)
- [Architecture Guide](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template/blob/main/docs/architecture.md)
- [Frontend Guide](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template/blob/main/docs/frontend.md)
- [AI Agent Guide](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template/blob/main/docs/ai-agent.md)
- [Deployment Guide](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template/blob/main/docs/deployment.md)
