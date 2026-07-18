"""
R2Storage — Cloudflare R2 adapter using the boto3 S3-compatible API.

Object key format:  users/{user_id}/{uuid}/{safe_filename}
This keeps objects isolated per-user and avoids filename collisions.

All objects are stored in a PRIVATE bucket.
Downloads are proxied through the backend — no presigned URLs in this release.
"""

import uuid
from collections.abc import Generator

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from app.core.config import get_settings
from app.storage.base import StorageAdapter, StorageError, UploadResult


def _make_safe_filename(filename: str) -> str:
    """Strip path separators and control characters from a filename."""
    import re
    # Keep only alphanumeric, dash, underscore, dot, space
    safe = re.sub(r"[^\w\s.\-]", "_", filename, flags=re.UNICODE)
    return safe.strip() or "upload"


class R2Storage(StorageAdapter):
    """
    Cloudflare R2 adapter.
    Instantiate per-upload; the boto3 client is lightweight to create.
    Falls back gracefully when R2 is not configured (raises StorageError).
    """

    CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB streaming chunks

    def __init__(self) -> None:
        settings = get_settings()
        if not settings.r2_configured:
            raise StorageError(
                "Cloudflare R2 is not configured. "
                "Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, "
                "and R2_ENDPOINT_URL in your .env file."
            )
        self._bucket = settings.r2_bucket_name
        self._client = boto3.client(
            "s3",
            endpoint_url=settings.r2_endpoint_url,
            aws_access_key_id=settings.r2_access_key_id,
            aws_secret_access_key=settings.r2_secret_access_key,
            region_name=settings.r2_region,
            config=Config(signature_version="s3v4"),
        )

    def _make_key(self, owner_id: uuid.UUID, filename: str) -> str:
        safe_name = _make_safe_filename(filename)
        return f"users/{owner_id}/{uuid.uuid4()}/{safe_name}"

    def upload(
        self,
        file_obj,
        filename: str,
        mime_type: str | None = None,
        owner_id: uuid.UUID | None = None,
        **kwargs,
    ) -> UploadResult:
        """Upload a file to R2. Returns the object key as provider_obj_id."""
        if owner_id is None:
            raise StorageError("owner_id is required for R2 uploads.")

        key = self._make_key(owner_id, filename)
        extra_args: dict = {}
        if mime_type:
            extra_args["ContentType"] = mime_type

        try:
            self._client.upload_fileobj(file_obj, self._bucket, key, ExtraArgs=extra_args)
        except ClientError as exc:
            raise StorageError(f"R2 upload failed: {exc}") from exc

        # Get actual size from R2 metadata
        size_bytes: int | None = None
        try:
            head = self._client.head_object(Bucket=self._bucket, Key=key)
            size_bytes = head.get("ContentLength")
        except ClientError:
            pass  # Size is best-effort

        return UploadResult(provider_obj_id=key, size_bytes=size_bytes, mime_type=mime_type)

    def download_stream(self, provider_obj_id: str) -> Generator[bytes, None, None]:
        """Stream the object body in 8 MB chunks."""
        try:
            response = self._client.get_object(Bucket=self._bucket, Key=provider_obj_id)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code in ("NoSuchKey", "404"):
                raise StorageError(f"Object not found in R2: {provider_obj_id}") from exc
            raise StorageError(f"R2 download failed: {exc}") from exc

        body = response["Body"]
        try:
            while chunk := body.read(self.CHUNK_SIZE):
                yield chunk
        finally:
            body.close()

    def delete(self, provider_obj_id: str) -> None:
        """Delete an object from R2. Swallows NoSuchKey (idempotent)."""
        try:
            self._client.delete_object(Bucket=self._bucket, Key=provider_obj_id)
        except ClientError as exc:
            error_code = exc.response["Error"]["Code"]
            if error_code not in ("NoSuchKey", "404"):
                raise StorageError(f"R2 delete failed: {exc}") from exc

    def get_metadata(self, provider_obj_id: str) -> dict:
        """Return basic metadata for an object."""
        try:
            head = self._client.head_object(Bucket=self._bucket, Key=provider_obj_id)
            return {
                "size_bytes": head.get("ContentLength"),
                "mime_type": head.get("ContentType"),
                "last_modified": head.get("LastModified"),
            }
        except ClientError as exc:
            raise StorageError(f"R2 metadata fetch failed: {exc}") from exc
