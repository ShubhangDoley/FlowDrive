"""
Storage adapter abstract base class.

All storage backends (Google Drive, Cloudflare R2, future providers) implement
this interface so that the service layer can swap providers transparently.

Upload flow:
  1. Service calls adapter.upload() → returns a provider_obj_id string
  2. Service persists the File record with that ID
  3. On download, service calls adapter.download_stream(provider_obj_id)
  4. On delete, service calls adapter.delete(provider_obj_id)
"""

from abc import ABC, abstractmethod
from collections.abc import Generator
from dataclasses import dataclass


@dataclass
class UploadResult:
    """Returned by StorageAdapter.upload() after a successful upload."""
    provider_obj_id: str   # Drive file ID or R2 object key
    size_bytes: int | None = None
    mime_type: str | None = None


class StorageAdapter(ABC):
    """
    Abstract interface all storage backends must implement.
    Methods should raise StorageError on recoverable errors.
    """

    @abstractmethod
    def upload(
        self,
        file_obj,            # file-like object (read())
        filename: str,
        mime_type: str | None = None,
        **kwargs,
    ) -> UploadResult:
        """
        Upload bytes from file_obj to the backend.
        Returns an UploadResult containing the stable object identifier.
        """

    @abstractmethod
    def download_stream(self, provider_obj_id: str) -> Generator[bytes, None, None]:
        """
        Yield the file content as chunks of bytes.
        Used to proxy downloads to the client without buffering the whole file.
        """

    @abstractmethod
    def delete(self, provider_obj_id: str) -> None:
        """Permanently remove the object from the backend."""

    @abstractmethod
    def get_metadata(self, provider_obj_id: str) -> dict:
        """Return a dict of available metadata (name, size, mime, etc.)."""


class StorageError(Exception):
    """Raised by adapters for recoverable storage-layer failures."""
    pass
