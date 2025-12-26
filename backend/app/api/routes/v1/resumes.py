"""Resume API routes.

Provides REST endpoints for managing resume uploads and text extraction.
"""

import logging
from uuid import UUID

from fastapi import APIRouter, File, Form, UploadFile

from app.api.deps import CurrentUser, ResumeSvc
from app.core.text_extraction import get_supported_mime_types
from app.schemas.resume import (
    ResumeResponse,
    ResumeSummary,
    ResumeTextResponse,
    ResumeUpdate,
)

logger = logging.getLogger(__name__)

router = APIRouter()


# Maximum file size: 10MB
MAX_FILE_SIZE = 10 * 1024 * 1024


@router.post("/upload", response_model=ResumeResponse, status_code=201)
async def upload_resume(
    current_user: CurrentUser,
    resume_service: ResumeSvc,
    file: UploadFile = File(..., description="Resume file (PDF, DOCX, or TXT)"),
    name: str = Form(..., min_length=1, max_length=100, description="Name for the resume"),
    set_primary: bool = Form(False, description="Set as primary resume"),
) -> ResumeResponse:
    """Upload a new resume file.

    Accepts PDF, DOCX, or plain text files. Automatically extracts
    text content for AI analysis.

    Maximum file size: 10MB
    """
    # Validate file type
    mime_type = file.content_type or "application/octet-stream"
    supported_types = get_supported_mime_types()

    if mime_type not in supported_types:
        from fastapi import HTTPException

        raise HTTPException(
            status_code=400,
            detail={
                "message": f"Unsupported file type: {mime_type}",
                "supported_types": supported_types,
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
    filename = file.filename or "resume"

    # Create resume
    resume = await resume_service.create_from_upload(
        user_id=current_user.id,
        name=name,
        file_data=file_data,
        filename=filename,
        mime_type=mime_type,
        set_primary=set_primary,
    )

    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        name=resume.name,
        original_filename=resume.original_filename,
        file_size=resume.file_size,
        mime_type=resume.mime_type,
        is_primary=resume.is_primary,
        has_text=bool(resume.text_content),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


@router.get("", response_model=list[ResumeSummary])
async def list_resumes(
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> list[ResumeSummary]:
    """List all resumes for the current user.

    Returns resumes ordered by primary status (primary first) then creation date.
    """
    resumes = await resume_service.list_for_user(current_user.id)
    return [
        ResumeSummary(
            id=r.id,
            name=r.name,
            original_filename=r.original_filename,
            is_primary=r.is_primary,
            has_text=bool(r.text_content),
        )
        for r in resumes
    ]


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: UUID,
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> ResumeResponse:
    """Get details of a specific resume.

    Does not include the text content. Use GET /{id}/text for that.
    """
    resume = await resume_service.get_by_id(resume_id, current_user.id)
    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        name=resume.name,
        original_filename=resume.original_filename,
        file_size=resume.file_size,
        mime_type=resume.mime_type,
        is_primary=resume.is_primary,
        has_text=bool(resume.text_content),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


@router.get("/{resume_id}/text", response_model=ResumeTextResponse)
async def get_resume_text(
    resume_id: UUID,
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> ResumeTextResponse:
    """Get the extracted text content of a resume.

    Returns the text that was extracted from the file for AI analysis.
    """
    resume = await resume_service.get_by_id(resume_id, current_user.id)
    return ResumeTextResponse(
        id=resume.id,
        name=resume.name,
        text_content=resume.text_content,
    )


@router.patch("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: UUID,
    update_data: ResumeUpdate,
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> ResumeResponse:
    """Update a resume's name or primary status."""
    resume = await resume_service.update(resume_id, current_user.id, update_data)
    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        name=resume.name,
        original_filename=resume.original_filename,
        file_size=resume.file_size,
        mime_type=resume.mime_type,
        is_primary=resume.is_primary,
        has_text=bool(resume.text_content),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


@router.delete("/{resume_id}", response_model=ResumeResponse)
async def delete_resume(
    resume_id: UUID,
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> ResumeResponse:
    """Delete a resume.

    Removes both the database record and the stored file.
    If the deleted resume was primary, another resume will become primary.
    """
    resume = await resume_service.delete(resume_id, current_user.id)
    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        name=resume.name,
        original_filename=resume.original_filename,
        file_size=resume.file_size,
        mime_type=resume.mime_type,
        is_primary=resume.is_primary,
        has_text=bool(resume.text_content),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


@router.post("/{resume_id}/set-primary", response_model=ResumeResponse)
async def set_primary_resume(
    resume_id: UUID,
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> ResumeResponse:
    """Set a resume as the primary.

    Only one resume can be primary at a time. Setting a new primary
    will unset any previous primary.
    """
    resume = await resume_service.set_primary(current_user.id, resume_id)
    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        name=resume.name,
        original_filename=resume.original_filename,
        file_size=resume.file_size,
        mime_type=resume.mime_type,
        is_primary=resume.is_primary,
        has_text=bool(resume.text_content),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )


@router.post("/{resume_id}/re-extract", response_model=ResumeResponse)
async def re_extract_text(
    resume_id: UUID,
    current_user: CurrentUser,
    resume_service: ResumeSvc,
) -> ResumeResponse:
    """Re-extract text from a resume file.

    Useful if initial extraction failed or the extraction logic was improved.
    """
    resume = await resume_service.re_extract_text(resume_id, current_user.id)
    return ResumeResponse(
        id=resume.id,
        user_id=resume.user_id,
        name=resume.name,
        original_filename=resume.original_filename,
        file_size=resume.file_size,
        mime_type=resume.mime_type,
        is_primary=resume.is_primary,
        has_text=bool(resume.text_content),
        created_at=resume.created_at,
        updated_at=resume.updated_at,
    )
