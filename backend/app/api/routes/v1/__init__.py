"""API v1 router aggregation."""
# ruff: noqa: I001 - Imports structured for Jinja2 template conditionals

from fastapi import APIRouter

from app.api.routes.v1 import health
from app.api.routes.v1 import auth, users
from app.api.routes.v1 import oauth
from app.api.routes.v1 import sessions
from app.api.routes.v1 import conversations
from app.api.routes.v1 import webhooks
from app.api.routes.v1 import ws
from app.api.routes.v1 import agent
from app.api.routes.v1 import config
from app.api.routes.v1 import pipelines
from app.api.routes.v1 import jobs
from app.api.routes.v1 import job_profile
from app.api.routes.v1 import resumes
from app.api.routes.v1 import stories
from app.api.routes.v1 import projects
from app.api.routes.v1 import email_sources

v1_router = APIRouter()

# Health check routes (no auth required)
v1_router.include_router(health.router, tags=["health"])

# Authentication routes
v1_router.include_router(auth.router, prefix="/auth", tags=["auth"])

# User routes
v1_router.include_router(users.router, prefix="/users", tags=["users"])

# OAuth2 routes
v1_router.include_router(oauth.router, prefix="/oauth", tags=["oauth"])

# Session management routes
v1_router.include_router(sessions.router, prefix="/sessions", tags=["sessions"])

# Conversation routes (AI chat persistence)
v1_router.include_router(conversations.router, prefix="/conversations", tags=["conversations"])

# Webhook routes
v1_router.include_router(webhooks.router, prefix="/webhooks", tags=["webhooks"])

# WebSocket routes
v1_router.include_router(ws.router, tags=["websocket"])

# AI Agent routes
v1_router.include_router(agent.router, tags=["agent"])

# Pipeline routes (automation workflows)
v1_router.include_router(pipelines.router, prefix="/pipelines", tags=["pipelines"])

# Public config routes (no auth required)
v1_router.include_router(config.router, prefix="/config", tags=["config"])

# Jobs routes (job search results)
v1_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])

# Job profile routes (resume and preferences)
v1_router.include_router(job_profile.router, prefix="/job-profiles", tags=["job-profiles"])

# Resume routes (resume file management)
v1_router.include_router(resumes.router, prefix="/resumes", tags=["resumes"])

# Story routes (user story/narrative management)
v1_router.include_router(stories.router, prefix="/stories", tags=["stories"])

# Project routes (project description management)
v1_router.include_router(projects.router, prefix="/projects", tags=["projects"])

# Email source routes (Gmail integration)
v1_router.include_router(email_sources.router, prefix="/email", tags=["email"])
