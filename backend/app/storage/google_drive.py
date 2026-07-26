"""
GoogleDriveStorage — Google Drive adapter for permanent file storage.

Files are uploaded into a dedicated 'FlowDrive' folder in the user's Drive.
This folder is created on first login and reused on subsequent uploads.

Scope used: https://www.googleapis.com/auth/drive.file
  → FlowDrive can only read/write files IT created (least-privilege).

Token refresh is handled automatically by the google-auth library with connection retries.
"""

import io
import time
from collections.abc import Generator

import requests
from urllib3.util.retry import Retry
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload, MediaIoBaseUpload

from app.core.config import get_settings
from app.storage.base import StorageAdapter, StorageError, UploadResult

DRIVE_SCOPES = ["https://www.googleapis.com/auth/drive.file"]
CHUNK_SIZE = 8 * 1024 * 1024  # 8 MB


def _get_http_request() -> Request:
    """Return a google-auth Request configured with TCP connection retries."""
    session = requests.Session()
    retries = Retry(
        total=5,
        backoff_factor=0.5,
        status_forcelist=[429, 500, 502, 503, 504],
        raise_on_status=False,
    )
    session.mount("https://", requests.adapters.HTTPAdapter(max_retries=retries))
    return Request(session=session)


def _build_credentials(refresh_token: str) -> Credentials:
    """Build a Credentials object from a refresh token with exponential backoff retries."""
    settings = get_settings()
    creds = Credentials(
        token=None,
        refresh_token=refresh_token,
        token_uri="https://oauth2.googleapis.com/token",
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        scopes=DRIVE_SCOPES,
    )
    req = _get_http_request()

    last_exc = None
    for attempt in range(3):
        try:
            creds.refresh(req)
            return creds
        except Exception as exc:
            last_exc = exc
            if attempt < 2:
                time.sleep(0.5 * (2 ** attempt))

    if last_exc:
        raise last_exc
    return creds


class GoogleDriveStorage(StorageAdapter):
    """
    Google Drive adapter.
    Requires a valid (decrypted) refresh token for the user.
    The Drive service object is built once per adapter instance.
    """
    def __init__(self, refresh_token: str) -> None:
        try:
            self._creds = _build_credentials(refresh_token)
            self._service = build("drive", "v3", credentials=self._creds, cache_discovery=False)
        except Exception as exc:
            if "invalid_grant" in str(exc):
                raise StorageError(
                    "Google Drive token has expired or been revoked by Google. "
                    "Please re-authorize by clicking 'Re-connect Google Drive Account'."
                ) from exc
            raise StorageError(f"Could not initialise Google Drive client: {exc}") from exc

    # ── Folder helpers ─────────────────────────────────────────────────────────

    def get_or_create_folder(self, folder_name: str) -> str:
        """
        Return the Drive file ID of the named folder, creating it if absent.
        Searches only in the root of Drive to avoid duplicates.
        """
        settings = get_settings()
        query = (
            f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' "
            f"and trashed=false"
        )
        try:
            result = (
                self._service.files()
                .list(q=query, fields="files(id, name)", spaces="drive")
                .execute()
            )
            files = result.get("files", [])
            if files:
                return files[0]["id"]

            # Create the folder
            metadata = {
                "name": folder_name,
                "mimeType": "application/vnd.google-apps.folder",
            }
            folder = (
                self._service.files()
                .create(body=metadata, fields="id")
                .execute()
            )
            return folder["id"]
        except HttpError as exc:
            raise StorageError(f"Drive folder operation failed: {exc}") from exc

    # ── StorageAdapter interface ───────────────────────────────────────────────

    def upload(
        self,
        file_obj,
        filename: str,
        mime_type: str | None = None,
        folder_id: str | None = None,
        **kwargs,
    ) -> UploadResult:
        """
        Upload a file to the user's FlowDrive folder in Google Drive.
        Returns the Drive file ID as provider_obj_id.
        Includes retry logic for transient socket resets.
        """
        settings = get_settings()
        if folder_id is None:
            folder_id = self.get_or_create_folder(settings.google_drive_folder_name)

        metadata = {"name": filename, "parents": [folder_id]}
        media = MediaIoBaseUpload(
            file_obj,
            mimetype=mime_type or "application/octet-stream",
            chunksize=CHUNK_SIZE,
            resumable=True,
        )

        drive_file = None
        last_exc = None
        for attempt in range(3):
            try:
                drive_file = (
                    self._service.files()
                    .create(body=metadata, media_body=media, fields="id,size,mimeType")
                    .execute()
                )
                break
            except (HttpError, OSError, ConnectionError, Exception) as exc:
                last_exc = exc
                if attempt < 2:
                    time.sleep(1.0 * (2 ** attempt))

        if not drive_file:
            raise StorageError(f"Drive upload failed: {last_exc}")

        size_bytes = int(drive_file.get("size", 0)) or None
        return UploadResult(
            provider_obj_id=drive_file["id"],
            size_bytes=size_bytes,
            mime_type=drive_file.get("mimeType", mime_type),
        )

    def download_stream(self, provider_obj_id: str) -> Generator[bytes, None, None]:
        """Stream a Drive file by ID in chunks."""
        try:
            request = self._service.files().get_media(fileId=provider_obj_id)
            buffer = io.BytesIO()
            downloader = MediaIoBaseDownload(buffer, request, chunksize=CHUNK_SIZE)
            done = False
            while not done:
                _, done = downloader.next_chunk()
                buffer.seek(0)
                yield buffer.read()
                buffer.seek(0)
                buffer.truncate()
        except HttpError as exc:
            raise StorageError(f"Drive download failed: {exc}") from exc

    def delete(self, provider_obj_id: str) -> None:
        """Permanently delete a Drive file by ID. Swallows 404 (idempotent)."""
        try:
            self._service.files().delete(fileId=provider_obj_id).execute()
        except HttpError as exc:
            if exc.status_code == 404:
                return  # Already gone — treat as success
            raise StorageError(f"Drive delete failed: {exc}") from exc

    def get_metadata(self, provider_obj_id: str) -> dict:
        """Return basic metadata for a Drive file."""
        try:
            meta = (
                self._service.files()
                .get(fileId=provider_obj_id, fields="id,name,size,mimeType,modifiedTime")
                .execute()
            )
            return {
                "size_bytes": int(meta.get("size", 0)) or None,
                "mime_type": meta.get("mimeType"),
                "last_modified": meta.get("modifiedTime"),
                "name": meta.get("name"),
            }
        except HttpError as exc:
            raise StorageError(f"Drive metadata fetch failed: {exc}") from exc
