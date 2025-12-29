# Personal Automations

A personal productivity platform for automating job search, applications, and related workflows. Built with FastAPI and Next.js, powered by AI agents.

**Status:** In Production

---

## What It Does

- **AI Chat Assistant** — WebSocket-based real-time chat with tool-calling capabilities
- **Job Search Automation** — Scrapes job listings, analyzes fit with AI, scores matches
- **Resume Management** — Upload resumes, extract text, link to job profiles
- **Cover Letter Generation** — AI-generated cover letters with PDF export
- **Application Tracking** — Track jobs through: New → Prepped → Reviewed → Applied
- **Pipeline System** — Configurable workflows triggered via chat or UI
- **Area-Specific Agents** — Jobs area has its own AI assistant with focused tooling

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | FastAPI, Pydantic v2, SQLAlchemy 2.0 (async), PostgreSQL, Redis |
| **Frontend** | Next.js 15, React 19, TypeScript, Tailwind CSS v4, Zustand |
| **AI** | PydanticAI, OpenAI, WebSocket streaming |
| **Background Jobs** | Taskiq |
| **Observability** | Logfire |
| **Deployment** | Docker, Traefik, DigitalOcean |

---

## Quick Start

```bash
# Start infrastructure
make docker-db && make docker-redis

# Backend
cd backend && uv sync && cp .env.example .env
uv run personal_automations db upgrade
uv run personal_automations user create --email admin@example.com --password secret123 --superuser
make run

# Frontend (new terminal)
cd frontend && bun install && bun dev
```

**Access:**
- Frontend: http://localhost:3000
- API Docs: http://localhost:8000/docs
- Admin: http://localhost:8000/admin

---

## Documentation

See the [`docs/`](./docs/) folder for detailed documentation:

- [Getting Started](./docs/getting-started.md) — Setup and development
- [Architecture](./docs/architecture.md) — System design and patterns
- [Backend](./docs/backend.md) — API endpoints and services
- [Frontend](./docs/frontend.md) — Components and state management
- [AI Agent](./docs/ai-agent.md) — PydanticAI configuration
- [Authentication](./docs/authentication.md) — JWT and OAuth
- [Deployment](./docs/deployment.md) — Production deployment

---

## Credits

Built on top of [Full-Stack FastAPI + Next.js Template](https://github.com/vstorm-co/full-stack-fastapi-nextjs-llm-template) by VStorm.

---

## License

MIT
