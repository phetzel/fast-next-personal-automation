"""Pydantic schemas."""
# ruff: noqa: I001, RUF022 - Imports structured for Jinja2 template conditionals

from app.schemas.token import Token, TokenPayload
from app.schemas.user import UserCreate, UserRead, UserUpdate

from app.schemas.session import SessionRead, SessionListResponse, LogoutAllResponse

from app.schemas.item import ItemCreate, ItemRead, ItemUpdate

from app.schemas.conversation import (
    ConversationCreate,
    ConversationRead,
    ConversationUpdate,
    MessageCreate,
    MessageRead,
    ToolCallRead,
)

from app.schemas.webhook import (
    WebhookCreate,
    WebhookRead,
    WebhookUpdate,
    WebhookDeliveryRead,
    WebhookListResponse,
    WebhookDeliveryListResponse,
    WebhookTestResponse,
)

from app.schemas.job import (
    JobCreate,
    JobUpdate,
    JobResponse,
    JobSummary,
    JobListResponse,
    JobStatsResponse,
    JobFilters,
)

from app.schemas.job_profile import (
    JobProfileCreate,
    JobProfileUpdate,
    JobProfileResponse,
    JobProfileSummary,
    ProfileRequiredError,
)

from app.schemas.resume import (
    ResumeCreate,
    ResumeUpdate,
    ResumeResponse,
    ResumeSummary,
    ResumeTextResponse,
)

from app.schemas.story import (
    StoryCreate,
    StoryUpdate,
    StoryResponse,
    StorySummary,
)

from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectResponse,
    ProjectSummary,
    ProjectTextResponse,
)

__all__ = [
    "UserCreate",
    "UserRead",
    "UserUpdate",
    "Token",
    "TokenPayload",
    "SessionRead",
    "SessionListResponse",
    "LogoutAllResponse",
    "ItemCreate",
    "ItemRead",
    "ItemUpdate",
    "ConversationCreate",
    "ConversationRead",
    "ConversationUpdate",
    "MessageCreate",
    "MessageRead",
    "ToolCallRead",
    "WebhookCreate",
    "WebhookRead",
    "WebhookUpdate",
    "WebhookDeliveryRead",
    "WebhookListResponse",
    "WebhookDeliveryListResponse",
    "WebhookTestResponse",
    # Job
    "JobCreate",
    "JobUpdate",
    "JobResponse",
    "JobSummary",
    "JobListResponse",
    "JobStatsResponse",
    "JobFilters",
    # JobProfile
    "JobProfileCreate",
    "JobProfileUpdate",
    "JobProfileResponse",
    "JobProfileSummary",
    "ProfileRequiredError",
    # Resume
    "ResumeCreate",
    "ResumeUpdate",
    "ResumeResponse",
    "ResumeSummary",
    "ResumeTextResponse",
    # Story
    "StoryCreate",
    "StoryUpdate",
    "StoryResponse",
    "StorySummary",
    # Project
    "ProjectCreate",
    "ProjectUpdate",
    "ProjectResponse",
    "ProjectSummary",
    "ProjectTextResponse",
]
