"""File storage abstraction for resume uploads.

Provides a simple interface for storing and retrieving files.
Supports local storage for development and S3 for production.
"""

import logging
import uuid
from abc import ABC, abstractmethod
from pathlib import Path
from typing import Literal

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

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
        subdir: str = "resumes",
    ) -> str:
        """Save a file and return its storage path.
        
        Args:
            file_data: The raw file bytes
            user_id: The user who owns the file
            filename: The original filename
            subdir: Subdirectory for file type (resumes, projects, etc.)
            
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
        subdir: str = "resumes",
    ) -> str:
        """Save a file to local storage."""
        # Create user directory
        user_dir = self.base_path / subdir / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        # Generate unique filename to avoid collisions
        unique_id = uuid.uuid4().hex[:8]
        # Sanitize filename to avoid path traversal
        safe_filename = Path(filename).name
        storage_filename = f"{unique_id}_{safe_filename}"

        # Build relative path
        relative_path = f"{subdir}/{user_id}/{storage_filename}"
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


class S3Storage(StorageBackend):
    """S3/MinIO storage backend for production.
    
    Files are stored in:
    s3://{bucket}/resumes/{user_id}/{uuid}_{filename}
    
    Supports AWS S3 and S3-compatible services (MinIO, etc.)
    via custom endpoint configuration.
    """

    def __init__(
        self,
        bucket: str,
        access_key: str,
        secret_key: str,
        region: str = "us-east-1",
        endpoint_url: str | None = None,
    ):
        self.bucket = bucket
        self.endpoint_url = endpoint_url
        
        # Configure boto3 client
        config = Config(
            signature_version='s3v4',
            retries={'max_attempts': 3, 'mode': 'standard'}
        )
        
        client_kwargs = {
            "service_name": "s3",
            "aws_access_key_id": access_key,
            "aws_secret_access_key": secret_key,
            "region_name": region,
            "config": config,
        }
        
        # Add custom endpoint for MinIO/S3-compatible services
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        
        self._client = boto3.client(**client_kwargs)
        self._ensure_bucket()

    def _ensure_bucket(self) -> None:
        """Ensure the bucket exists, create if needed."""
        try:
            self._client.head_bucket(Bucket=self.bucket)
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchBucket"):
                logger.info(f"Creating S3 bucket: {self.bucket}")
                self._client.create_bucket(Bucket=self.bucket)
            else:
                raise

    def _build_key(self, user_id: uuid.UUID, filename: str, subdir: str = "resumes") -> str:
        """Build S3 object key."""
        unique_id = uuid.uuid4().hex[:8]
        safe_filename = Path(filename).name
        return f"{subdir}/{user_id}/{unique_id}_{safe_filename}"

    async def save(
        self,
        file_data: bytes,
        user_id: uuid.UUID,
        filename: str,
        subdir: str = "resumes",
    ) -> str:
        """Save a file to S3."""
        key = self._build_key(user_id, filename, subdir)
        
        try:
            self._client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=file_data,
            )
            logger.info(f"Saved file to s3://{self.bucket}/{key} ({len(file_data)} bytes)")
            return key
        except ClientError as e:
            logger.error(f"Failed to save to S3: {e}")
            raise IOError(f"Failed to save file to S3: {e}")

    async def load(self, file_path: str) -> bytes:
        """Load a file from S3."""
        try:
            response = self._client.get_object(Bucket=self.bucket, Key=file_path)
            return response["Body"].read()
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey"):
                raise FileNotFoundError(f"File not found: {file_path}")
            raise

    async def delete(self, file_path: str) -> bool:
        """Delete a file from S3."""
        try:
            # Check if exists first
            self._client.head_object(Bucket=self.bucket, Key=file_path)
            self._client.delete_object(Bucket=self.bucket, Key=file_path)
            logger.info(f"Deleted file: s3://{self.bucket}/{file_path}")
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey"):
                return False
            raise

    async def exists(self, file_path: str) -> bool:
        """Check if a file exists in S3."""
        try:
            self._client.head_object(Bucket=self.bucket, Key=file_path)
            return True
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code", "")
            if error_code in ("404", "NoSuchKey"):
                return False
            raise


# Type alias for storage backend selection
StorageType = Literal["local", "s3"]


def get_storage_backend() -> StorageType:
    """Determine which storage backend to use based on configuration.
    
    If STORAGE_BACKEND is "auto" (default), uses S3 if credentials are configured.
    Otherwise uses the explicitly configured backend.
    """
    backend = settings.STORAGE_BACKEND
    
    if backend == "s3":
        return "s3"
    elif backend == "local":
        return "local"
    else:  # auto
        # Check if S3 credentials are configured
        if settings.S3_ACCESS_KEY and settings.S3_SECRET_KEY:
            return "s3"
        return "local"


def get_storage() -> StorageBackend:
    """Get the configured storage backend.
    
    Returns:
        The storage backend instance based on configuration.
    """
    backend = get_storage_backend()
    
    if backend == "s3":
        logger.info(f"Using S3 storage: bucket={settings.S3_BUCKET}")
        return S3Storage(
            bucket=settings.S3_BUCKET,
            access_key=settings.S3_ACCESS_KEY,
            secret_key=settings.S3_SECRET_KEY,
            region=settings.S3_REGION,
            endpoint_url=settings.S3_ENDPOINT,
        )
    else:
        logger.info(f"Using local file storage: {settings.STORAGE_LOCAL_PATH}")
        return LocalStorage(settings.STORAGE_LOCAL_PATH)


# Singleton instance for convenience
_storage: StorageBackend | None = None


async def get_storage_instance() -> StorageBackend:
    """Get or create the storage backend singleton."""
    global _storage
    if _storage is None:
        _storage = get_storage()
    return _storage

