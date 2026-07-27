<div align="center">

# 🌌 FlowDrive

### *Bring Your Own Storage — Hybrid Multi-Cloud Storage Platform*

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com/)
[![React](https://img.shields.io/badge/Frontend-React_19-61DAFB?style=for-the-badge&logo=react)](https://react.dev/)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?style=for-the-badge&logo=cloudflare)](https://pages.cloudflare.com/)
[![Render](https://img.shields.io/badge/Deploy-Render_Docker-46E3B7?style=for-the-badge&logo=render)](https://render.com/)
[![License](https://img.shields.io/badge/License-MIT-blue.svg?style=for-the-badge)](LICENSE)

---

**FlowDrive** is a state-of-the-art, open-source multi-cloud storage platform that lets users bring their own cloud storage space (Google Drive & Cloudflare R2) under a single unified, futuristic glassmorphic dashboard.

</div>

---

## ✨ Features

- 🎨 **Futuristic Glassmorphic Space UI**: Built with dynamic WebGL 3D Prism Shaders (OGL), glowing specular cards, and a clean 50/50 split dashboard layout.
- 🔑 **Multi-Account Google Drive Linking**: Connect multiple Google Drive accounts to a single FlowDrive user profile. Switch default target drives with a single click.
- 🛡️ **Zero Data Lock-in**: All permanent files live directly in your personal Google Drive inside a dedicated `FlowDrive` folder.
- ⏱️ **Temporary Auto-Expiring Storage**: Store temporary files (1 hour, 24 hours, or 7 days) powered by Cloudflare R2 with automatic background cleanup schedules.
- 🔒 **Enterprise-Grade Security**:
  - SHA-256 + Bcrypt password hashing for local accounts.
  - Signed cryptographic state tokens (`itsdangerous`) for OAuth 2.0 PKCE flow.
  - Fernet symmetric encryption (AES-128-CBC) for storing OAuth refresh tokens securely in database.
  - SameSite=None + Secure cross-site session cookies.

---

## 🛠️ Technology Stack

### **Frontend**
- **Framework**: React 19 + Vite
- **Styling**: Tailwind CSS v4 + Vanilla CSS Design Tokens
- **Visual Effects**: OGL WebGL 3D Prism Shader (`Prism.jsx`)
- **Icons**: Lucide React

### **Backend**
- **Framework**: FastAPI (Python 3.11)
- **Database ORM**: SQLAlchemy 2.0 (Dialect-agnostic: SQLite & PostgreSQL compatible)
- **Security & Encryption**: Cryptography (Fernet), PyCryptodome, Bcrypt, ItsDangerous
- **Background Tasks**: APScheduler (Automated temporary file cleanup)
- **Logging**: Structlog + JSON-formatted unbuffered standard output

---

## 🌐 Live Demo Architecture

| Component | Platform | Live URL |
| :--- | :--- | :--- |
| **Frontend UI** | Cloudflare Pages | `https://flowdrive-80s.pages.dev` |
| **Backend API** | Render (Docker) | `https://flowdrive-backend-2.onrender.com` |

---

## 📖 Self-Hosting & Deployment Guide

Follow this guide to deploy your own instance of FlowDrive with your own Google OAuth Client Credentials!

---

### Step 1: Create Google OAuth 2.0 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project named **FlowDrive**.
3. Navigate to **APIs & Services** > **Library** and search for **Google Drive API**. Click **Enable**.
4. Go to **APIs & Services** > **OAuth consent screen**:
   - Choose **External** user type.
   - Fill in app name (**FlowDrive**), user support email, and developer contact information.
   - Under **Scopes**, add the following scopes:
     - `openid`
     - `https://www.googleapis.com/auth/userinfo.email`
     - `https://www.googleapis.com/auth/userinfo.profile`
     - `https://www.googleapis.com/auth/drive.file` *(Restricted scope — only accesses files created by FlowDrive)*
   - Add test users (your email address) if your app status is in Testing.
5. Go to **APIs & Services** > **Credentials** > **Create Credentials** > **OAuth client ID**:
   - Application Type: **Web Application**.
   - Name: `FlowDrive Web Client`.
   - **Authorized JavaScript origins**:
     - `https://<your-cloudflare-pages-domain>.pages.dev`
     - `http://localhost:5173` *(for local development)*
   - **Authorized redirect URIs**:
     - `https://<your-backend-render-domain>.onrender.com/api/v1/auth/google/callback`
     - `http://localhost:8000/api/v1/auth/google/callback` *(for local development)*
6. Copy your **Client ID** and **Client Secret**.

---

### Step 2: Deploy Backend on Render

1. Fork or push this repository to your GitHub account.
2. Sign in to [Render Dashboard](https://dashboard.render.com/) and click **New +** > **Web Service**.
3. Connect your GitHub repository.
4. Select **Docker** as the Environment.
5. Add the following **Environment Variables** in Render:

| Variable Name | Description | Example Value |
| :--- | :--- | :--- |
| `APP_ENV` | Application environment | `production` |
| `FRONTEND_URL` | Your Cloudflare Pages URL | `https://your-flowdrive.pages.dev` |
| `SESSION_SECRET` | Secret key for signed cookies | *Any random 32+ character string* |
| `TOKEN_ENCRYPTION_KEY` | Key for Fernet refresh token encryption | *Any random 32+ character string* |
| `GOOGLE_CLIENT_ID` | Your Google OAuth Client ID | `123456789-abc.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Your Google OAuth Client Secret | `GOCSPX-xyz123...` |
| `GOOGLE_OAUTH_REDIRECT_URI` | Google OAuth Callback URL | `https://your-flowdrive-backend.onrender.com/api/v1/auth/google/callback` |
| `GOOGLE_DRIVE_FOLDER_NAME` | Folder created in user's Drive | `FlowDrive` |

6. Click **Create Web Service**. Render will automatically build the Docker container and start your server!
7. **⚡ Pro Tip — Keep Free Render Instance Awake**:
   Render's free tier spins down web services after 15 minutes of inactivity. To prevent cold starts and keep your backend instantly responsive 24/7:
   - Create a free account on [cron-job.org](https://cron-job.org/) or [UptimeRobot](https://uptimerobot.com/).
   - Set up an automated HTTP `GET` request every **10-14 minutes** targeting your `/health` endpoint:
     `https://<your-backend-render-domain>.onrender.com/health`

---

### Step 3: Deploy Frontend on Cloudflare Pages

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/) and go to **Workers & Pages**.
2. Click **Create Application** > **Pages** > **Connect to Git**.
3. Select your repository.
4. Configure Build Settings:
   - **Framework Preset**: `Vite`
   - **Root directory**: `/` (or leave empty)
   - **Build command**: `cd frontend && npm install && npm run build`
   - **Build output directory**: `frontend/dist`
5. Under **Environment Variables (Advanced)**, add:
   - `VITE_API_BASE_URL`: `https://your-flowdrive-backend.onrender.com`
6. Click **Save and Deploy**. Cloudflare Pages will build and deploy your frontend globally!

---

## 💻 Local Development Setup

### 1. Prerequisites
- Python 3.11+
- Node.js 18+
- Git

### 2. Clone Repository
```bash
git clone https://github.com/ShubhangDoley/FlowDrive.git
cd FlowDrive
```

### 3. Start Backend Server
```bash
cd backend
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*Backend will be running at `http://localhost:8000` (Swagger docs at `http://localhost:8000/docs`).*

### 4. Start Frontend Client
```bash
cd frontend
npm install
npm run dev
```
*Frontend will be running at `http://localhost:5173`.*

---

## 🛰️ API Architecture

```
FlowDrive API (/api/v1)
 ├── /health                          [GET] Health check & DB status
 ├── /auth
 │    ├── /register                   [POST] Register username/password
 │    ├── /login                      [POST] Authenticate user
 │    ├── /logout                     [POST] Clear session cookie
 │    ├── /me                         [GET] Fetch current authenticated user
 │    ├── /google/connect-url         [GET] Fetch Google OAuth consent URL
 │    ├── /google/connect             [GET] Direct OAuth redirect
 │    └── /google/callback            [GET] OAuth callback from Google
 ├── /drive
 │    └── /accounts
 │         ├── /                      [GET] List connected Google Drive accounts
 │         ├── /{id}                  [DELETE] Disconnect Drive account
 │         └── /{id}/default          [PATCH] Set default active Drive account
 └── /files
      ├── /                           [GET] List all uploaded files
      ├── /upload                     [POST] Upload file (Drive / R2)
      ├── /{id}                       [DELETE] Remove file
      └── /{id}/download              [GET] Download file from storage
```

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

