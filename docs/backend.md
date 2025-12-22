# Backend Documentation

The backend is built with FastAPI and follows a clean layered architecture.

## API Endpoints

All endpoints are prefixed with `/api/v1`.

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Basic health check |
| GET | `/ready` | Readiness probe (checks DB/Redis) |

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/login` | Login with email/password |
| POST | `/auth/register` | Register new user |
| POST | `/auth/refresh` | Refresh access token |
| POST | `/auth/logout` | Logout (invalidate session) |
| GET | `/auth/me` | Get current user info |

### OAuth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/oauth/google/login` | Redirect to Google login |
| GET | `/oauth/google/callback` | Google OAuth callback |

### Users

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/users/me` | Get current user |
| PATCH | `/users/me` | Update current user |
| GET | `/users/{user_id}` | Get user by ID (admin) |

### Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/sessions` | List active sessions |
| DELETE | `/sessions/{session_id}` | Revoke session |

### Conversations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/conversations` | List user's conversations |
| POST | `/conversations` | Create new conversation |
| GET | `/conversations/{id}` | Get conversation with messages |
| DELETE | `/conversations/{id}` | Delete conversation |

### Items (Example CRUD)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/items` | List items (paginated) |
| POST | `/items` | Create item |
| GET | `/items/{id}` | Get item |
| PATCH | `/items/{id}` | Update item |
| DELETE | `/items/{id}` | Delete item |

### Webhooks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/webhooks` | List webhooks |
| POST | `/webhooks` | Create webhook |
| GET | `/webhooks/{id}` | Get webhook |
| PATCH | `/webhooks/{id}` | Update webhook |
| DELETE | `/webhooks/{id}` | Delete webhook |
| GET | `/webhooks/{id}/deliveries` | Get delivery logs |

### WebSocket

| Endpoint | Description |
|----------|-------------|
| `/ws/agent` | AI chat WebSocket (authenticated) |

## Services

### UserService

```python
from app.services.user import UserService

# Available methods
await user_service.register(user_in: UserCreate) -> User
await user_service.authenticate(email, password) -> User
await user_service.get_by_id(user_id) -> User
await user_service.get_by_email(email) -> User | None
await user_service.update(user_id, user_in: UserUpdate) -> User
await user_service.delete(user_id) -> User
```

### ConversationService

```python
from app.services.conversation import ConversationService

# Available methods
await conv_service.create_conversation(data: ConversationCreate) -> Conversation
await conv_service.get_conversation(conv_id) -> Conversation
await conv_service.get_user_conversations(user_id) -> list[Conversation]
await conv_service.add_message(conv_id, message: MessageCreate) -> Message
await conv_service.delete_conversation(conv_id) -> None
```

### SessionService

```python
from app.services.session import SessionService

# Available methods
await session_service.create_session(user_id, refresh_token, ...) -> Session
await session_service.validate_refresh_token(token) -> Session | None
await session_service.logout_by_refresh_token(token) -> None
await session_service.get_user_sessions(user_id) -> list[Session]
await session_service.revoke_session(session_id) -> None
```

## Configuration

Configuration is managed via environment variables in `app/core/config.py`:

```python
from app.core.config import settings

# Access settings
settings.DATABASE_URL
settings.SECRET_KEY
settings.OPENAI_API_KEY
```

### Key Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `ENVIRONMENT` | `local` | `local`, `development`, `staging`, `production` |
| `DEBUG` | `False` | Enable debug mode |
| `SECRET_KEY` | - | JWT signing key (32+ chars) |
| `POSTGRES_*` | - | Database connection |
| `REDIS_*` | - | Redis connection |
| `OPENAI_API_KEY` | - | OpenAI API key |
| `AI_MODEL` | `gpt-4o-mini` | Default AI model |
| `RATE_LIMIT_REQUESTS` | `100` | Requests per period |
| `RATE_LIMIT_PERIOD` | `60` | Rate limit period (seconds) |

## Exception Handling

Custom exceptions in `app/core/exceptions.py`:

```python
from app.core.exceptions import (
    NotFoundError,
    AlreadyExistsError,
    AuthenticationError,
    AuthorizationError,
    ValidationError,
)

# Usage
raise NotFoundError(message="User not found", details={"user_id": user_id})
raise AuthenticationError(message="Invalid credentials")
```

Exception handlers convert these to proper HTTP responses:

| Exception | HTTP Status |
|-----------|-------------|
| `NotFoundError` | 404 |
| `AlreadyExistsError` | 409 |
| `AuthenticationError` | 401 |
| `AuthorizationError` | 403 |
| `ValidationError` | 422 |

## Database Migrations

Using Alembic for migrations:

```bash
# Create migration
uv run personal_automations db migrate -m "Add new field"

# Apply migrations
uv run personal_automations db upgrade

# Rollback
uv run personal_automations db downgrade -1

# Show current version
uv run personal_automations db current

# Show history
uv run personal_automations db history
```

## Background Tasks

Using Taskiq for async background jobs:

```python
# app/worker/tasks/examples.py
from app.worker.taskiq_app import broker

@broker.task
async def send_email_task(to: str, subject: str, body: str):
    """Send an email asynchronously."""
    await send_email(to, subject, body)

# Calling the task
await send_email_task.kiq("user@example.com", "Hello", "Body text")
```

Start workers:
```bash
uv run personal_automations taskiq worker
uv run personal_automations taskiq scheduler  # For scheduled tasks
```

## CLI Commands

### Server Commands

```bash
personal_automations server run --reload  # Start dev server
personal_automations server routes        # List all routes
```

### User Commands

```bash
personal_automations user create          # Interactive user creation
personal_automations user create --email user@example.com --password secret --superuser
personal_automations user list            # List all users
personal_automations user set-role user@example.com --role admin
```

### Custom Commands

Add custom commands in `app/commands/`:

```python
# app/commands/seed.py
from app.commands import command, success
import click

@command("seed", help="Seed database with test data")
@click.option("--count", "-c", default=10, type=int)
def seed_database(count: int):
    # Your logic here
    success(f"Created {count} records!")
```

Run with:
```bash
personal_automations cmd seed --count 100
```

## Testing

```bash
# Run all tests
make test

# Run with coverage
make test-cov

# Run specific test file
uv run pytest tests/api/test_auth.py -v
```

