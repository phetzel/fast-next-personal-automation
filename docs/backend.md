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
| `/ws/agent?area=jobs` | Area-specific AI chat |

### Jobs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/jobs` | List user's job listings |
| GET | `/jobs/{id}` | Get job details |
| PATCH | `/jobs/{id}` | Update job (status, notes, cover_letter) |
| DELETE | `/jobs/{id}` | Delete job |
| GET | `/jobs/stats` | Get job statistics |
| POST | `/jobs/{id}/cover-letter/generate-pdf` | Generate/regenerate cover letter PDF |
| GET | `/jobs/{id}/cover-letter/download` | Download cover letter PDF |
| GET | `/jobs/{id}/cover-letter/preview` | Preview cover letter PDF in browser |

### Job Profiles

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/job-profiles` | List user's profiles |
| POST | `/job-profiles` | Create profile |
| GET | `/job-profiles/{id}` | Get profile |
| PATCH | `/job-profiles/{id}` | Update profile (including contact info for cover letters) |
| DELETE | `/job-profiles/{id}` | Delete profile |
| POST | `/job-profiles/{id}/set-default` | Set as default |
| GET | `/job-profiles/default` | Get default profile |

Job profiles include contact info fields for cover letter generation:
- `contact_full_name` - Full name for cover letter header
- `contact_phone` - Phone number
- `contact_email` - Email (falls back to user email)
- `contact_location` - Location (e.g., "Portland, Oregon")
- `contact_website` - Personal website URL

### Resumes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/resumes` | List user's resumes |
| POST | `/resumes/upload` | Upload resume file |
| GET | `/resumes/{id}` | Get resume details |
| DELETE | `/resumes/{id}` | Delete resume |
| POST | `/resumes/{id}/set-primary` | Set as primary |
| POST | `/resumes/{id}/re-extract` | Re-extract text |

### Email Integration

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/email/sources` | List connected email accounts |
| GET | `/email/sources/{id}` | Get email source with stats |
| GET | `/email/gmail/connect` | Start Gmail OAuth flow |
| GET | `/email/gmail/callback` | Handle Gmail OAuth callback |
| POST | `/email/sources/{id}/sync` | Trigger manual email sync |
| PATCH | `/email/sources/{id}` | Update source settings |
| DELETE | `/email/sources/{id}` | Disconnect email account |
| GET | `/email/sources/{id}/messages` | List processed messages |
| GET | `/email/config` | Get email config (supported senders) |

### Pipelines

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/pipelines` | List available pipelines |
| GET | `/pipelines?area=jobs` | List pipelines filtered by area |
| POST | `/pipelines/{name}/execute` | Execute a pipeline |
| GET | `/pipeline-runs` | List pipeline run history |

#### Job Pipelines

| Pipeline | Description |
|----------|-------------|
| `job_search` | Search job boards and analyze fit against resume |
| `job_prep` | Auto-analyzes application page, then generates cover letter (if needed) and prep notes |
| `job_apply` | Assist with or automate application submission |
| `email_sync_jobs` | Sync job listings from connected email accounts |

> **Note:** `job_analyze` exists as an internal module used by `job_prep` (via `auto_analyze=True`) and `job_apply`, but is not exposed as a standalone pipeline.

### Area Agents

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/agent/areas` | List available area configs |
| POST | `/agent/areas/{area}/chat` | Chat with area agent (non-streaming) |

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

### JobProfileService

```python
from app.services.job_profile import JobProfileService

# Available methods
await profile_service.create(user_id, data: JobProfileCreate) -> JobProfile
await profile_service.get_by_id(profile_id) -> JobProfile | None
await profile_service.list_for_user(user_id) -> list[JobProfile]
await profile_service.get_or_create_default(user_id) -> JobProfile
await profile_service.update(profile_id, data: JobProfileUpdate) -> JobProfile
await profile_service.delete(profile_id) -> None
await profile_service.set_default(profile_id, user_id) -> JobProfile
```

### ResumeService

```python
from app.services.resume import ResumeService

# Available methods
await resume_service.create_from_upload(user_id, file, name) -> Resume
await resume_service.get_by_id(resume_id) -> Resume | None
await resume_service.list_for_user(user_id) -> list[Resume]
await resume_service.delete(resume_id) -> None
await resume_service.set_primary(resume_id, user_id) -> Resume
await resume_service.get_text_content(resume_id) -> str | None
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
| `BROWSER_HEADLESS` | `True` | Run Playwright browser in headless mode |
| `BROWSER_TIMEOUT` | `30000` | Browser operation timeout in milliseconds |
| `BROWSER_USE_AI_MODEL` | `gpt-4o` | Model for AI-powered browser analysis |
| `GOOGLE_GMAIL_REDIRECT_URI` | - | Gmail OAuth callback URL |
| `EMAIL_SYNC_INTERVAL_MINUTES` | `60` | How often to sync email sources |
| `EMAIL_SYNC_LOOKBACK_HOURS` | `72` | How far back to look on first sync |

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

## Email Integration

### Current Implementation

The email integration automatically syncs job alert emails from connected Gmail accounts:

- **Supported Job Boards**: Indeed, LinkedIn, HiringCafe, Glassdoor, Dice, ZipRecruiter
- **Sync Frequency**: Every hour via scheduled task
- **Parsers**: Template-based (BeautifulSoup) for known formats, AI fallback (GPT-4o-mini) for unknown

### Architecture

```
Gmail API → GmailClient → Email Parsers → Job Records
                ↑                ↓
          EmailSource      EmailMessage
          (OAuth tokens)   (processed tracking)
```

### Future Enhancements (Phase 3)

#### Real-Time Sync
- Gmail Watch API for push notifications instead of polling
- Pub/Sub webhook endpoint for instant processing
- WebSocket updates to frontend for live notifications
- Toast notifications: "3 new jobs found!"

#### Smart Parser Improvements
- Self-improving AI parser that learns from user corrections
- User feedback buttons: "This wasn't a job" / "Add missing job"
- Parser confidence scores displayed on job cards
- Auto-generate template parsers from successful AI extractions

#### Processed Email Viewer
- View original email that created a job
- "View source email" link on job detail page
- Re-parse emails with different parser
- Mark emails for manual review queue

#### Sync Dashboard
- Real-time sync status indicator
- Historical sync timeline and statistics
- Per-source success/failure rates
- Parser performance metrics

#### Cross-Area Integrations
- Detect "interview scheduled" emails → update job status
- Detect "rejection" emails → auto-dismiss job
- Detect "offer" emails → highlight job
- Link emails to conversation threads with recruiters

## Potential Email Management Area

If expanding beyond job alerts to a full email management system:

### Core Features
- **Inbox View**: List, search, filter all emails
- **Email Actions**: Mark read/unread, star, archive, delete
- **Compose**: Send emails (requires `gmail.send` scope)
- **Threads**: View email conversations grouped by thread

### Smart Parsing
- Job alerts → Extract to Jobs area
- Receipts → Extract to Expenses
- Calendar invites → Extract to Calendar
- Package tracking → Extract shipment info
- Custom rules: "If sender=X, apply label Y"

### Automation Rules
User-defined rules with conditions and actions:
```python
class EmailRule:
    conditions: dict  # {"from_contains": "recruiter", "subject_contains": "interview"}
    actions: dict     # {"apply_label": "Important", "notify": true, "extract_to": "jobs"}
```

### Analytics
- Email volume trends over time
- Top senders/domains
- Response time analytics
- Unsubscribe recommendations for newsletters

