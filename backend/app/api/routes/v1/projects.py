"""Project API routes.

Provides REST endpoints for managing project description uploads.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, File, Form, UploadFile

from app.api.deps import CurrentUser, ProjectSvc
from app.schemas.project import (
    ProjectResponse,
    ProjectSummary,
    ProjectTextResponse,
    ProjectUpdate,
)
from app.services.project import SUPPORTED_PROJECT_MIME_TYPES

logger = logging.getLogger(__name__)

router = APIRouter()


# Maximum file size: 5MB (markdown files shouldn't be large)
MAX_FILE_SIZE = 5 * 1024 * 1024


@router.post("/upload", response_model=ProjectResponse, status_code=201)
async def upload_project(
    current_user: CurrentUser,
    project_service: ProjectSvc,
    file: UploadFile = File(..., description="Project description file (Markdown or TXT)"),
    name: str = Form(..., min_length=1, max_length=100, description="Name for the project"),
    is_active: bool = Form(True, description="Whether the project is active"),
) -> ProjectResponse:
    """Upload a new project description file.

    Accepts Markdown (.md) or plain text (.txt) files.
    Multiple projects can be active at the same time.

    Maximum file size: 5MB
    """
    # Validate file type
    mime_type = file.content_type or "text/plain"
    
    # Handle common markdown MIME type variations
    if file.filename and file.filename.endswith(".md"):
        mime_type = "text/markdown"

    if mime_type not in SUPPORTED_PROJECT_MIME_TYPES:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Unsupported file type: {mime_type}",
                "supported_types": SUPPORTED_PROJECT_MIME_TYPES,
            },
        )

    # Read file content
    file_data = await file.read()

    # Validate file size
    if len(file_data) > MAX_FILE_SIZE:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail={
                "message": f"File too large. Maximum size: {MAX_FILE_SIZE // (1024 * 1024)}MB",
                "size": len(file_data),
            },
        )

    # Get original filename
    filename = file.filename or "project.md"

    # Create project
    project = await project_service.create_from_upload(
        user_id=current_user.id,
        name=name,
        file_data=file_data,
        filename=filename,
        mime_type=mime_type,
        is_active=is_active,
    )

    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        original_filename=project.original_filename,
        file_size=project.file_size,
        mime_type=project.mime_type,
        is_active=project.is_active,
        has_text=bool(project.text_content),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("", response_model=list[ProjectSummary])
async def list_projects(
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> list[ProjectSummary]:
    """List all projects for the current user.

    Returns projects ordered by active status (active first) then creation date.
    """
    projects = await project_service.list_for_user(current_user.id)
    return [
        ProjectSummary(
            id=p.id,
            name=p.name,
            original_filename=p.original_filename,
            is_active=p.is_active,
            has_text=bool(p.text_content),
        )
        for p in projects
    ]


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: UUID,
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> ProjectResponse:
    """Get details of a specific project.

    Does not include the text content. Use GET /{id}/text for that.
    """
    project = await project_service.get_by_id(project_id, current_user.id)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        original_filename=project.original_filename,
        file_size=project.file_size,
        mime_type=project.mime_type,
        is_active=project.is_active,
        has_text=bool(project.text_content),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.get("/{project_id}/text", response_model=ProjectTextResponse)
async def get_project_text(
    project_id: UUID,
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> ProjectTextResponse:
    """Get the text content of a project.

    Returns the markdown content from the uploaded file.
    """
    project = await project_service.get_by_id(project_id, current_user.id)
    return ProjectTextResponse(
        id=project.id,
        name=project.name,
        text_content=project.text_content,
    )


@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    update_data: ProjectUpdate,
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> ProjectResponse:
    """Update a project's name or active status."""
    project = await project_service.update(project_id, current_user.id, update_data)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        original_filename=project.original_filename,
        file_size=project.file_size,
        mime_type=project.mime_type,
        is_active=project.is_active,
        has_text=bool(project.text_content),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_id}", response_model=ProjectResponse)
async def delete_project(
    project_id: UUID,
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> ProjectResponse:
    """Delete a project.

    Removes both the database record and the stored file.
    """
    project = await project_service.delete(project_id, current_user.id)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        original_filename=project.original_filename,
        file_size=project.file_size,
        mime_type=project.mime_type,
        is_active=project.is_active,
        has_text=bool(project.text_content),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("/{project_id}/toggle-active", response_model=ProjectResponse)
async def toggle_project_active(
    project_id: UUID,
    is_active: bool,
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> ProjectResponse:
    """Toggle the active status of a project.

    Multiple projects can be active at the same time.
    """
    project = await project_service.toggle_active(current_user.id, project_id, is_active)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        original_filename=project.original_filename,
        file_size=project.file_size,
        mime_type=project.mime_type,
        is_active=project.is_active,
        has_text=bool(project.text_content),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.post("/{project_id}/re-extract", response_model=ProjectResponse)
async def re_extract_text(
    project_id: UUID,
    current_user: CurrentUser,
    project_service: ProjectSvc,
) -> ProjectResponse:
    """Re-extract text from a project file.

    Useful if initial extraction failed or the extraction logic was improved.
    """
    project = await project_service.re_extract_text(project_id, current_user.id)
    return ProjectResponse(
        id=project.id,
        user_id=project.user_id,
        name=project.name,
        original_filename=project.original_filename,
        file_size=project.file_size,
        mime_type=project.mime_type,
        is_active=project.is_active,
        has_text=bool(project.text_content),
        created_at=project.created_at,
        updated_at=project.updated_at,
    )

