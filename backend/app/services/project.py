"""Project service (PostgreSQL async).

Contains business logic for project operations.
Uses project repository for database access.
"""

import logging
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError, ValidationError
from app.core.storage import get_storage_instance
from app.db.models.project import Project
from app.repositories import project_repo
from app.repositories.project import ProjectRepository
from app.schemas.project import ProjectUpdate
from app.services.base import BaseService

logger = logging.getLogger(__name__)

# Supported MIME types for project files (markdown)
SUPPORTED_PROJECT_MIME_TYPES = [
    "text/markdown",
    "text/x-markdown",
    "text/plain",  # Also allow plain text
]


def is_supported_project_mime_type(mime_type: str) -> bool:
    """Check if a MIME type is supported for project uploads."""
    return mime_type in SUPPORTED_PROJECT_MIME_TYPES


class ProjectService(BaseService[Project, ProjectRepository]):
    """Service for project business logic."""

    entity_name = "Project"

    def __init__(self, db: AsyncSession):
        super().__init__(db, project_repo._repository)

    async def list_for_user(self, user_id: UUID) -> list[Project]:
        """Get all projects for a user, ordered by creation date."""
        return await project_repo.get_by_user_id(self.db, user_id)

    async def create_from_upload(
        self,
        user_id: UUID,
        name: str,
        file_data: bytes,
        filename: str,
        mime_type: str,
    ) -> Project:
        """Create a new project from an uploaded file.

        Handles file storage and text extraction.

        Args:
            user_id: The user who owns the project
            name: User-friendly name for the project
            file_data: Raw file bytes
            filename: Original filename
            mime_type: MIME type of the file

        Returns:
            The created project

        Raises:
            ValidationError: If the file type is not supported
        """
        # Validate MIME type
        if not is_supported_project_mime_type(mime_type):
            raise ValidationError(
                message=f"Unsupported file type: {mime_type}",
                details={
                    "mime_type": mime_type,
                    "supported_types": SUPPORTED_PROJECT_MIME_TYPES,
                },
            )

        # Extract text content (for markdown files, just decode)
        text_content = None
        try:
            text_content = file_data.decode("utf-8")
        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")
            # Continue without text content

        # Save file to storage
        storage = await get_storage_instance()
        file_path = await storage.save(file_data, user_id, filename, subdir="projects")

        # Create database record
        project = await project_repo.create(
            self.db,
            user_id=user_id,
            name=name,
            original_filename=filename,
            file_path=file_path,
            file_size=len(file_data),
            mime_type=mime_type,
            text_content=text_content,
        )

        return project

    async def get_text_content(self, project_id: UUID, user_id: UUID) -> str | None:
        """Get the text content for a project.

        Args:
            project_id: The project ID
            user_id: The user who owns the project

        Returns:
            The text content, or None if not available

        Raises:
            NotFoundError: If project doesn't exist or doesn't belong to user
        """
        project = await self.get_by_id(project_id, user_id)
        return project.text_content

    async def update(
        self,
        project_id: UUID,
        user_id: UUID,
        update_data: ProjectUpdate,
    ) -> Project:
        """Update a project.

        Raises:
            NotFoundError: If project does not exist.
        """
        project = await self.get_by_id(project_id, user_id)
        data = update_data.model_dump(exclude_unset=True)

        return await project_repo.update(self.db, db_project=project, update_data=data)

    async def delete(self, project_id: UUID, user_id: UUID) -> Project:
        """Delete a project.

        Removes both the database record and the stored file.

        Raises:
            NotFoundError: If project does not exist.
        """
        project = await self.get_by_id(project_id, user_id)
        file_path = project.file_path

        deleted = await project_repo.delete(self.db, project_id)
        if not deleted:
            raise NotFoundError(
                message="Project not found",
                details={"project_id": str(project_id)},
            )

        # Delete the stored file
        try:
            storage = await get_storage_instance()
            await storage.delete(file_path)
        except Exception as e:
            logger.warning(f"Failed to delete stored file {file_path}: {e}")

        return deleted

    async def re_extract_text(self, project_id: UUID, user_id: UUID) -> Project:
        """Re-extract text content from a project file.

        Useful if initial extraction failed or the extraction logic was improved.

        Raises:
            NotFoundError: If project doesn't exist
            ValidationError: If extraction fails
        """
        project = await self.get_by_id(project_id, user_id)

        # Load file from storage
        storage = await get_storage_instance()
        try:
            file_data = await storage.load(project.file_path)
        except FileNotFoundError as e:
            raise ValidationError(
                message="Project file not found in storage",
                details={"file_path": project.file_path},
            ) from e

        # Extract text
        try:
            text_content = file_data.decode("utf-8")
        except Exception as e:
            raise ValidationError(
                message=f"Failed to decode file: {e}",
                details={"project_id": str(project_id)},
            ) from e

        # Update database
        return await project_repo.update(
            self.db,
            db_project=project,
            update_data={"text_content": text_content},
        )
