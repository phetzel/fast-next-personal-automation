"""Resume service (PostgreSQL async).

Contains business logic for resume operations.
Uses resume repository for database access.
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ValidationError
from app.core.storage import get_storage_instance
from app.core.text_extraction import (
    extract_text_from_file,
    get_supported_mime_types,
    is_supported_mime_type,
)
from app.db.models.resume import Resume
from app.repositories import resume_repo
from app.repositories.resume import ResumeRepository
from app.schemas.resume import ResumeUpdate
from app.services.base import PrimaryEntityService

logger = logging.getLogger(__name__)


class ResumeService(PrimaryEntityService[Resume, ResumeRepository]):
    """Service for resume business logic."""

    entity_name = "Resume"

    def __init__(self, db: AsyncSession):
        super().__init__(db, resume_repo._repository)

    async def create_from_upload(
        self,
        user_id: UUID,
        name: str,
        file_data: bytes,
        filename: str,
        mime_type: str,
        set_primary: bool = False,
    ) -> Resume:
        """Create a new resume from an uploaded file.

        Handles file storage and text extraction.

        Args:
            user_id: The user who owns the resume
            name: User-friendly name for the resume
            file_data: Raw file bytes
            filename: Original filename
            mime_type: MIME type of the file
            set_primary: Whether to set as the primary resume

        Returns:
            The created resume

        Raises:
            ValidationError: If the file type is not supported
        """
        # Validate MIME type
        if not is_supported_mime_type(mime_type):
            raise ValidationError(
                message=f"Unsupported file type: {mime_type}",
                details={
                    "mime_type": mime_type,
                    "supported_types": get_supported_mime_types(),
                },
            )

        # Extract text content
        text_content = None
        try:
            text_content = extract_text_from_file(file_data, mime_type)
            if text_content and len(text_content) < 100:
                logger.warning(f"Extracted text is very short ({len(text_content)} chars)")
        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")
            # Continue without text content - user can re-extract later

        # Save file to storage
        storage = await get_storage_instance()
        file_path = await storage.save(file_data, user_id, filename)

        async def create_resume(is_primary: bool) -> Resume:
            return await resume_repo.create(
                self.db,
                user_id=user_id,
                name=name,
                original_filename=filename,
                file_path=file_path,
                file_size=len(file_data),
                mime_type=mime_type,
                text_content=text_content,
                is_primary=is_primary,
            )

        return await self._create_with_primary_check(
            user_id,
            set_primary,
            create_resume,
        )

    async def get_text_content(self, resume_id: UUID, user_id: UUID) -> str | None:
        """Get the text content for a resume.

        Args:
            resume_id: The resume ID
            user_id: The user who owns the resume

        Returns:
            The text content, or None if not available

        Raises:
            NotFoundError: If resume doesn't exist or doesn't belong to user
        """
        resume = await self.get_by_id(resume_id, user_id)
        return resume.text_content

    async def update(
        self,
        resume_id: UUID,
        user_id: UUID,
        update_data: ResumeUpdate,
    ) -> Resume:
        """Update a resume.

        Raises:
            NotFoundError: If resume does not exist.
        """
        resume = await self.get_by_id(resume_id, user_id)
        data = update_data.model_dump(exclude_unset=True)

        updated = await resume_repo.update(self.db, db_resume=resume, update_data=data)

        # If marked as primary, unset other primary
        if data.get("is_primary"):
            await self._ensure_single_primary(user_id, resume_id)

        return updated

    async def delete(self, resume_id: UUID, user_id: UUID) -> Resume:
        """Delete a resume.

        Removes both the database record and the stored file.
        If deleting the primary resume, another resume will become primary.

        Raises:
            NotFoundError: If resume does not exist.
        """
        resume = await self.get_by_id(resume_id, user_id)
        file_path = resume.file_path

        # Use parent's delete logic for primary handling
        deleted = await super().delete(resume_id, user_id)

        # Delete the stored file
        try:
            storage = await get_storage_instance()
            await storage.delete(file_path)
        except Exception as e:
            logger.warning(f"Failed to delete stored file {file_path}: {e}")

        return deleted

    async def re_extract_text(self, resume_id: UUID, user_id: UUID) -> Resume:
        """Re-extract text content from a resume file.

        Useful if initial extraction failed or the extraction logic was improved.

        Raises:
            NotFoundError: If resume doesn't exist
            ValidationError: If extraction fails
        """
        resume = await self.get_by_id(resume_id, user_id)

        # Load file from storage
        storage = await get_storage_instance()
        try:
            file_data = await storage.load(resume.file_path)
        except FileNotFoundError as e:
            raise ValidationError(
                message="Resume file not found in storage",
                details={"file_path": resume.file_path},
            ) from e

        # Extract text
        try:
            text_content = extract_text_from_file(file_data, resume.mime_type)
        except ValueError as e:
            raise ValidationError(
                message=str(e),
                details={"resume_id": str(resume_id)},
            ) from e

        # Update database
        return await resume_repo.update(
            self.db,
            db_resume=resume,
            update_data={"text_content": text_content},
        )
