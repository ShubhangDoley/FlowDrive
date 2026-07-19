# FlowDrive (placeholder name)

**Unified cloud storage with Bring Your Own Storage and temporary sharing.**

A user connects their own cloud storage (starting with Google Drive), gets a clean
unified interface to manage files, and can generate temporary, password-protected,
expiring share links — something Google Drive doesn't do well natively.

---

## Concept Improvement: Unified File Gateway

Rather than positioning this as "Google Drive with Cloudflare," position it as a
**Unified File Gateway** — storage becomes a plugin/provider behind a common interf



built as a one-off integration.

---

## Phase 1 — MVP (Core)

**Goal:** A user can log in, connect Google Drive, upload, browse, download, and
delete files.

### Backend
- FastAPI
- Google OAuth
- Store OAuth refresh token securely
- Google Drive API integration

### Frontend
- React + Tailwind
- Login with Google
- Dashboard

### Features
- Google Login
- Upload file
- Download
- Delete
- Create folder
- Search files
- View storage usage

### Architecture
```
React
   │
FastAPI
   │
Google OAuth
   │
Google Drive API
```

### Resume value
- OAuth
- REST APIs
- Third-party API integration

---

## Phase 2 — Temporary Sharing ⭐

Add something Google Drive doesn't provide well.

### Features
```
Share Link

Expires after
○ 1 hour
○ 24 hours
○ 7 days

Password
Download Limit
```

### Backend stores
```
share_id
file_id
expiry
password_hash
downloads
max_downloads
```

This is the feature that gives users a reason to use the platform instead of
Drive directly.

---

## Phase 3 — Hybrid Storage

Introduce Cloudflare R2. Route by **intended file lifetime**, not by size.

```
Temporary Files
        │
        ▼
Cloudflare R2

Permanent Files
        │
        ▼
Google Drive
```

### Upload intent options
```
Temporary Upload
Permanent Upload
Archive
```

Making the storage choice explicit (or lifetime-based) rather than purely
size-based is the architecturally sound decision.

---

## Phase 4 — Dashboard

```
Storage
  Google Drive
  Cloudflare

Recent Uploads
Temporary Files
Shared Links
```

### Also show
```
Expires in
  12 hours
  5 days
  Never
```

---

## Phase 5 — File Preview

Preview without downloading:
- PDF
- MP4
- MP3
- Images
- Text

---

## Phase 6 — Nice UX

- Drag & Drop
- Upload Progress
- Dark Mode
- Infinite Scroll
- Skeleton Loading
- Toast Notifications

---

## Phase 7 — Security

- Password-protected links
  ```
  Enter Password
  ********
  ```
- Encrypted share IDs
- Signed URLs
- Rate limiting
- Virus scan hook (optional)

---

## Phase 8 — Analytics

### Per file
```
Downloads
Last Accessed
Created
Expires
Views
```

### Charts
- Top downloaded
- Most shared
- Storage trend

---

## Phase 9 — Optional AI

### Semantic search
```
invoice june
college assignment
python notes
```

Use embeddings or simple metadata indexing for natural-language file search.

---

## Tech Stack

### Frontend
- React
- Tailwind
- TanStack Query
- React Router

### Backend
- FastAPI
- SQLAlchemy
- Alembic
- APScheduler / Celery (cleanup jobs)

### Database
PostgreSQL

**Tables**
```
users
files
share_links
folders
oauth_tokens
```

### Storage
- Google Drive API
- Cloudflare R2
- Local storage (development)

### Deployment
- **Frontend:** Cloudflare Pages
- **Backend:** Railway or Render
- **Database:** Neon PostgreSQL

### Folder Structure
```
frontend/
backend/
shared/
docs/
README.md
```

---

## Interview Questions This Project Enables

- Why did you choose OAuth over your own authentication?
- How do you refresh expired Google access tokens?
- Why use object storage instead of storing files in the database?
- How do you implement expiring links?
- How do you prevent unauthorized downloads?
- How do you clean up expired files?
- How would you scale uploads to millions of files?
- How do presigned URLs work?
- How would you add support for Dropbox or OneDrive?

These questions open discussion of architecture, security, background processing,
and API design — not just CRUD.

---

## Suggested Priority (1–2 Week MVP Window)

1. **Phase 1** — non-negotiable, this is the working product
2. **Phase 2** — the differentiator, do this before polish
3. **Phase 3 (partial)** — at least the routing decision + R2 upload path, even if minimal
4. **Phase 4** — thin dashboard tying it together
5. Everything else (5–9) is stretch/polish, prioritize based on time and what you
   want to highlight on a resume (Phase 9's embeddings search is the strongest
   algorithmic addition if you have time for one more phase)