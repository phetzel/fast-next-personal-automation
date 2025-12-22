# Getting Started

This guide walks you through setting up the project for local development.

## Prerequisites

- **Python 3.11+** (managed via [uv](https://docs.astral.sh/uv/))
- **Node.js 20+** or [Bun](https://bun.sh/)
- **Docker** (for PostgreSQL and Redis)
- **OpenAI API Key** (for AI agent functionality)

## Setup

### 1. Clone and Install Dependencies

```bash
# Install backend dependencies
cd backend
uv sync --dev

# Install frontend dependencies
cd ../frontend
bun install  # or: npm install
```

### 2. Start Infrastructure

```bash
# From project root
make docker-db    # Start PostgreSQL on port 5432
make docker-redis # Start Redis on port 6379

# Or start both at once:
make docker-up
```

### 3. Configure Environment

Copy the example environment file and configure it:

```bash
cd backend
cp .env.example .env
```

**Required settings in `.env`:**

```env
# Database
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=personal_automations

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Security (generate with: openssl rand -hex 32)
SECRET_KEY=your-32-character-secret-key

# AI Agent
OPENAI_API_KEY=sk-your-openai-api-key
AI_MODEL=gpt-4o-mini

# Optional: Google OAuth
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/v1/oauth/google/callback
```

### 4. Initialize Database

```bash
cd backend

# Run migrations
uv run personal_automations db upgrade

# Create admin user
uv run personal_automations user create --email admin@example.com --password secret123 --superuser
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd backend
uv run personal_automations server run --reload
# or: make run
```

**Terminal 2 - Frontend:**
```bash
cd frontend
bun dev
# or: npm run dev
```

## Access Points

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| API | http://localhost:8000 |
| API Docs (Swagger) | http://localhost:8000/docs |
| API Docs (ReDoc) | http://localhost:8000/redoc |
| Admin Panel | http://localhost:8000/admin |

## Useful Commands

### Backend (from project root)

```bash
make run           # Start dev server with reload
make test          # Run tests
make lint          # Check code quality
make format        # Auto-format code

# Database
make db-migrate    # Create new migration
make db-upgrade    # Apply migrations
make db-downgrade  # Rollback last migration

# Users
make user-create   # Create new user (interactive)
make user-list     # List all users
```

### CLI

```bash
cd backend

# Server
uv run personal_automations server run --reload
uv run personal_automations server routes

# Database
uv run personal_automations db upgrade
uv run personal_automations db migrate -m "Add new field"

# Users
uv run personal_automations user create --email user@example.com
uv run personal_automations user list

# Custom commands
uv run personal_automations cmd seed --count 10
```

### Docker

```bash
make docker-up       # Start all services
make docker-down     # Stop all services
make docker-logs     # View logs
make docker-shell    # Shell into app container
```

## Troubleshooting

### Database Connection Failed

Ensure PostgreSQL is running:
```bash
docker ps | grep postgres
# If not running:
make docker-db
```

### Redis Connection Failed

Ensure Redis is running:
```bash
docker ps | grep redis
# If not running:
make docker-redis
```

### AI Agent Not Responding

1. Check `OPENAI_API_KEY` is set in `.env`
2. Verify the key is valid
3. Check backend logs for errors

### Admin Panel Access Denied

You need a superuser account:
```bash
uv run personal_automations user create --email admin@example.com --password secret123 --superuser
```

## Next Steps

- [Backend Documentation](./backend.md) - API endpoints and services
- [Frontend Documentation](./frontend.md) - Components and hooks
- [AI Agent Documentation](./ai-agent.md) - Agent configuration and tools

