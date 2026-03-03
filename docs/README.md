# Personal Automations Documentation

Welcome to the documentation for **personal_automations** - a full-stack AI chatbot application built with FastAPI and Next.js.

## Quick Links

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System architecture and design patterns |
| [Backend](./backend.md) | FastAPI backend, API endpoints, and services |
| [Frontend](./frontend.md) | Next.js frontend, components, and state management |
| [AI Agent](./ai-agent.md) | PydanticAI agent setup, tools, and WebSocket streaming |
| [Authentication](./authentication.md) | JWT, OAuth, and API key authentication |
| [Getting Started](./getting-started.md) | Setup and development guide |
| [Deployment](./deployment.md) | Production deployment to DigitalOcean |

## Tech Stack

### Backend
- **FastAPI** - High-performance async Python API framework
- **PostgreSQL** - Primary database (async with asyncpg)
- **Redis** - Caching and session storage
- **PydanticAI** - Type-safe AI agent framework
- **SQLAlchemy 2.0** - Async ORM
- **Alembic** - Database migrations

### Frontend
- **Next.js 15** - React framework with App Router
- **React 19** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS v4** - Styling
- **Zustand** - State management

### AI/LLM
- **PydanticAI** - AI agent framework with tool support
- **OpenAI** - LLM provider (configurable)
- **WebSocket** - Real-time streaming responses

## Project Structure

```
personal_automations/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app entry point
│   │   ├── api/routes/v1/       # API endpoints
│   │   ├── agents/              # PydanticAI agents
│   │   ├── core/                # Config, security, middleware
│   │   ├── db/models/           # SQLAlchemy models
│   │   ├── schemas/             # Pydantic schemas
│   │   ├── repositories/        # Data access layer
│   │   ├── services/            # Business logic
│   │   ├── commands/            # CLI commands
│   │   └── worker/              # Background tasks (Taskiq)
│   ├── cli/                     # Project CLI
│   ├── tests/                   # Test suite
│   └── alembic/                 # Database migrations
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js App Router pages
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom React hooks
│   │   ├── stores/              # Zustand state stores
│   │   ├── lib/                 # Utilities
│   │   └── types/               # TypeScript types
│   └── e2e/                     # Playwright E2E tests
├── docs/                        # Documentation (you are here)
├── docker-compose.yml           # Development containers
└── Makefile                     # Common commands
```

## Key Features

- ✅ **AI Chat Interface** - Real-time WebSocket streaming with tool visualization
- ✅ **JWT Authentication** - Access + refresh tokens with session management
- ✅ **Google OAuth** - Social login support
- ✅ **Conversation Persistence** - Save chat history per user
- ✅ **Admin Panel** - SQLAdmin at `/admin` for database management
- ✅ **Rate Limiting** - Configurable request limits
- ✅ **Observability** - Logfire integration for tracing
- ✅ **Background Tasks** - Taskiq for async job processing
- ✅ **Webhooks** - Event-driven integrations

## Getting Started

See [Getting Started](./getting-started.md) for detailed setup instructions.

**Quick start:**

```bash
# Start infrastructure
make docker-db && make docker-redis

# Setup backend
cd backend && uv sync && cp .env.example .env
uv run personal_automations db upgrade
uv run personal_automations user create --email admin@example.com --password secret123 --superuser
uv run personal_automations server run --reload

# Setup frontend (new terminal)
cd frontend && bun install && bun dev
```

**Access:**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Admin Panel: http://localhost:8000/admin

