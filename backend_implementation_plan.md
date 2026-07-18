  # FlowDrive Storage Backend

  ## Summary

  Build the initial FastAPI backend in the existing empty backend/ directory using the existing Conda dev environment. Google sign-in creates the FlowDrive
  user and connects that same user’s Google Drive; permanent uploads go to a user-owned FlowDrive Drive folder, while temporary uploads go to a private
  Cloudflare R2 bucket and expire after 1 hour, 24 hours, or 7 days.

  BFRI: 4 (moderate). OAuth and file storage are security-sensitive, so enforce layered design, centralized configuration, structured logging/Sentry,
  ownership checks, and automated tests.

  ## Implementation Changes

  1. Bootstrap the backend
      - Create a FastAPI application with app/ modules for config, routes, controllers, services, repositories, models, schemas, storage, middleware, and
        tests.

      - Keep the required flow: routes -> controllers -> services -> repositories; storage adapters are injected into services.
      - Use synchronous SQLAlchemy 2 with PostgreSQL and Alembic migrations for the fastest stable MVP.

  2. Install dependencies in Conda dev
      - Install FastAPI runtime and server tools, Alembic, psycopg, Pydantic settings, multipart upload support, Google OAuth/Drive libraries, boto3,
        cryptography, APScheduler, Sentry SDK, structlog, and pytest tooling.

      - Retain the already installed FastAPI 0.111.0 and SQLAlchemy 2.0.36 unless dependency resolution requires compatible upgrades.

  3. Centralize configuration and secrets
      - Add backend/.env.example with no secrets and ignore backend/.env.
      - Load configuration only through a Pydantic settings module; no direct environment-variable access outside it.
      - Store the real values locally in backend/.env:

  APP_ENV=development
  FRONTEND_URL=http://localhost:5173
  DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST:5432/flowdrive
  SESSION_SECRET=<long-random-secret>
  TOKEN_ENCRYPTION_KEY=<Fernet-key>
  SENTRY_DSN=

  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GOOGLE_OAUTH_REDIRECT_URI=http://localhost:8000/api/v1/auth/google/callback
  GOOGLE_DRIVE_FOLDER_NAME=FlowDrive

  R2_ACCOUNT_ID=
  R2_ACCESS_KEY_ID=
  R2_SECRET_ACCESS_KEY=
  R2_BUCKET_NAME=
  R2_ENDPOINT_URL=https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com
  R2_REGION=auto

  UPLOAD_MAX_BYTES=104857600
  TEMP_CLEANUP_INTERVAL_MINUTES=15

  - Register GOOGLE_OAUTH_REDIRECT_URI in Google Cloud Console under the OAuth client’s authorized redirect URIs. Create the R2 bucket and an R2 API token
    with access limited to that bucket.

  4. Add persistence and migrations
      - users: UUID, Google subject ID, email, display name, avatar URL, timestamps.
      - oauth_tokens: user ID, encrypted refresh token, optional access-token expiry, provider metadata.
      - files: UUID, owner ID, filename, MIME type, byte size, provider (google_drive or cloudflare_r2), provider object ID/key, intent (permanent or
        temporary), optional expiry, timestamps.

      - Create unique constraints for Google subject and one OAuth connection per user.

  5. Implement Google identity and Drive connection
      - GET /api/v1/auth/google/login creates and stores an OAuth state value, then redirects to Google.
      - GET /api/v1/auth/google/callback validates state, exchanges the code, upserts the user, encrypts and saves the refresh token, creates or reuses the
        user’s FlowDrive Drive folder, establishes the secure session, and redirects to the frontend.

      - Request openid, email, profile, and https://www.googleapis.com/auth/drive.file; the latter limits FlowDrive to files it creates in the user’s Drive.
      - POST /api/v1/auth/logout clears the session; GET /api/v1/auth/me returns the current user and Drive connection status.

  6. Implement storage adapters and upload routing
      - Define a common adapter interface: upload, list, download stream, delete, and metadata lookup.
      - GoogleDriveStorage uploads permanent files to the user’s FlowDrive folder.
      - R2Storage uploads temporary files into a private object key prefix scoped to the FlowDrive user.
      - POST /api/v1/files accepts multipart file, intent, and, for temporary files, expiry_hours restricted to 1, 24, or 168; it chooses the provider,
        uploads, then persists file metadata.

      - Use backend-proxied uploads/downloads in this release. Add direct R2 presigned browser uploads later when large-file scalability matters.

  7. Expose file-management APIs for the current frontend
      - GET /api/v1/files?intent=all|permanent|temporary lists only the authenticated user’s records.
      - GET /api/v1/files/{file_id}/download validates ownership, streams from the selected provider, and rejects expired temporary files.
      - DELETE /api/v1/files/{file_id} validates ownership, deletes the remote object, then deletes local metadata.
      - Return a consistent response envelope and Pydantic-validated errors suitable for replacing the frontend’s current mock file data.

  8. Add expiry cleanup and operational safeguards
      - Run APScheduler in the single MVP backend process every 15 minutes.
      - Delete expired R2 objects and associated database records; make each cleanup run idempotent and log partial failures for retry.
      - Add request IDs, structured logs, Sentry FastAPI integration, CORS restricted to FRONTEND_URL, upload-size validation, safe filename handling, and
        authenticated ownership checks on every file endpoint.

  ## Test Plan

  - Unit-test configuration validation, OAuth state handling, token encryption/decryption, upload-intent routing, expiry validation, and ownership
    enforcement.

  - Mock Google Drive and R2 adapters to verify correct provider calls, metadata persistence only after successful uploads, and remote-object cleanup on
    failures.

  - Integration-test login callback handling, session-protected routes, permanent upload/download/delete, temporary upload/download/delete, and expiry
    cleanup.

  - Verify that an expired temporary file cannot be downloaded and that one user cannot access another user’s file.
  - Run Alembic migrations against a test PostgreSQL database and start the FastAPI app with the dev Conda environment.

  ## Assumptions

  - Google OAuth is the sole initial authentication method; email/password and magic-link authentication are excluded.
  - FlowDrive manages only files it creates in the user’s dedicated Google Drive folder; importing or browsing all pre-existing Drive content is deferred.
  - R2 is private and is accessed only by the backend in this release.
  - Share links, folders, search, previews, analytics, additional providers, and UX polish are deferred. AI semantic search is the final optional phase.