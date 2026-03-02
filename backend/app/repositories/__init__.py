"""Repository layer for database operations."""
# ruff: noqa: I001, RUF022 - Imports structured for Jinja2 template conditionals

from app.repositories.base import BaseRepository

from app.repositories import user as user_repo

from app.repositories import session as session_repo

from app.repositories import conversation as conversation_repo

from app.repositories import webhook as webhook_repo

from app.repositories import pipeline_run as pipeline_run_repo

from app.repositories import job as job_repo

from app.repositories import job_profile as job_profile_repo

from app.repositories import resume as resume_repo

from app.repositories import story as story_repo

from app.repositories import project as project_repo

from app.repositories import email_source as email_source_repo

from app.repositories import email_sync as email_sync_repo

from app.repositories import email_destination as email_destination_repo

from app.repositories import scheduled_task as scheduled_task_repo

from app.repositories import finance as finance_repo

__all__ = [
    "BaseRepository",
    "user_repo",
    "session_repo",
    "conversation_repo",
    "webhook_repo",
    "pipeline_run_repo",
    "job_repo",
    "job_profile_repo",
    "resume_repo",
    "story_repo",
    "project_repo",
    "email_source_repo",
    "email_sync_repo",
    "email_destination_repo",
    "scheduled_task_repo",
    "finance_repo",
]
