"""File storage abstraction for resume uploads.

Provides a simple interface for storing and retrieving files.
Currently supports local storage for development.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from pathlib import Path

from app.core.config import settings

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    """Abstract base class for file storage backends."""

    @abstractmethod
    async def save(
        self,
        file_data: bytes,
        user_id: uuid.UUID,
        filename: str,
    ) -> str:
        """Save a file and return its storage path.
        
        Args:
            file_data: The raw file bytes
            user_id: The user who owns the file
            filename: The original filename
            
        Returns:
            The storage path (relative to storage root)
        """
        pass

    @abstractmethod
    async def load(self, file_path: str) -> bytes:
        """Load a file from storage.
        
        Args:
            file_path: The storage path returned by save()
            
        Returns:
            The file contents as bytes
            
        Raises:
            FileNotFoundError: If the file doesn't exist
        """
        pass

    @abstractmethod
    async def delete(self, file_path: str) -> bool:
        """Delete a file from storage.
        
        Args:
            file_path: The storage path to delete
            
        Returns:
            True if deleted, False if file didn't exist
        """
        pass

    @abstractmethod
    async def exists(self, file_path: str) -> bool:
        """Check if a file exists in storage.
        
        Args:
            file_path: The storage path to check
            
        Returns:
            True if exists, False otherwise
        """
        pass


class LocalStorage(StorageBackend):
    """Local filesystem storage backend for development.
    
    Files are stored in:
    uploads/resumes/{user_id}/{uuid}_{filename}
    """

    def __init__(self, base_path: str = "./uploads"):
        self.base_path = Path(base_path)
        self._ensure_base_path()

    def _ensure_base_path(self) -> None:
        """Ensure the base storage path exists."""
        self.base_path.mkdir(parents=True, exist_ok=True)

    def _get_full_path(self, file_path: str) -> Path:
        """Get the full filesystem path for a storage path."""
        return self.base_path / file_path

    async def save(
        self,
        file_data: bytes,
        user_id: uuid.UUID,
        filename: str,
    ) -> str:
        """Save a file to local storage."""
        # Create user directory
        user_dir = self.base_path / "resumes" / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename to avoid collisions
        unique_id = uuid.uuid4().hex[:8]
        # Sanitize filename to avoid path traversal
        safe_filename = Path(filename).name
        storage_filename = f"{unique_id}_{safe_filename}"

        # Build relative path
        relative_path = f"resumes/{user_id}/{storage_filename}"
        full_path = self.base_path / relative_path

        # Write file
        full_path.write_bytes(file_data)
        logger.info(f"Saved file to {relative_path} ({len(file_data)} bytes)")

        return relative_path

    async def load(self, file_path: str) -> bytes:
        """Load a file from local storage."""
        full_path = self._get_full_path(file_path)
        if not full_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")
        return full_path.read_bytes()

    async def delete(self, file_path: str) -> bool:
        """Delete a file from local storage."""
        full_path = self._get_full_path(file_path)
        if full_path.exists():
            full_path.unlink()
            logger.info(f"Deleted file: {file_path}")
            return True
        return False

    async def exists(self, file_path: str) -> bool:
        """Check if a file exists in local storage."""
        full_path = self._get_full_path(file_path)
        return full_path.exists()


# Storage backend configuration
STORAGE_BACKEND = getattr(settings, "STORAGE_BACKEND", "local")
STORAGE_LOCAL_PATH = getattr(settings, "STORAGE_LOCAL_PATH", "./uploads")


def get_storage() -> StorageBackend:
    """Get the configured storage backend.
    
    Returns:
        The storage backend instance based on configuration.
    """
    if STORAGE_BACKEND == "local":
        return LocalStorage(STORAGE_LOCAL_PATH)
    else:
        # Default to local storage
        return LocalStorage(STORAGE_LOCAL_PATH)


# Singleton instance for convenience
_storage: StorageBackend | None = None


async def get_storage_instance() -> StorageBackend:
    """Get or create the storage backend singleton."""
    global _storage
    if _storage is None:
        _storage = get_storage()
    return _storage

