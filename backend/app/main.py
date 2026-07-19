"""
FlowDrive FastAPI application factory.

Middleware stack (outermost → innermost):
  RequestIDMiddleware → SessionMiddleware → CORSMiddleware → routes

Startup:
  - Configure structlog
  - Optionally init Sentry
  - Start APScheduler for temp-file cleanup
"""

import os

import structlog
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.middleware.request_id import RequestIDMiddleware
from app.routes.auth import router as auth_router
from app.routes.files import router as files_router
from app.services.cleanup_service import run_cleanup

settings = get_settings()

# ── Allow OAuth over plain HTTP in local dev ──────────────────────────────────
# google-auth-oauthlib raises InsecureTransportError when redirect_uri uses
# http:// unless this env var is set. Never set in production.
if not settings.is_production:
    os.environ.setdefault("OAUTHLIB_INSECURE_TRANSPORT", "1")

# ── Configure logging before anything else ────────────────────────────────────
configure_logging(is_production=settings.is_production)
logger = structlog.get_logger(__name__)

# ── Sentry (optional) ─────────────────────────────────────────────────────────
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.starlette import StarletteIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[StarletteIntegration(), FastApiIntegration()],
        traces_sample_rate=0.2,
        environment=settings.app_env,
    )
    logger.info("sentry_initialized")


# ── App factory ───────────────────────────────────────────────────────────────
def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        description="FlowDrive — Unified Cloud Storage Gateway API",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None,
    )

    # ── Middleware (added in reverse order — first added = outermost) ─────────

    # 1. Request ID — must be outermost so request_id is in all logs
    app.add_middleware(RequestIDMiddleware)

    # 2. Session — cookie-based sessions (signed with SESSION_SECRET)
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.session_secret,
        session_cookie="flowdrive_session",
        max_age=60 * 60 * 24 * 7,  # 7 days
        https_only=settings.cookie_secure,
        same_site="lax",
    )

    # 3. CORS — restrict to the configured frontend origin
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[settings.frontend_url],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Routers ────────────────────────────────────────────────────────────────
    app.include_router(auth_router)
    app.include_router(files_router)

    # ── Health check ───────────────────────────────────────────────────────────
    @app.get("/health", tags=["ops"], summary="Health check")
    def health():
        from app.core.database import check_db_connection
        db_ok = check_db_connection()
        return {
            "status": "ok" if db_ok else "degraded",
            "database": "connected" if db_ok else "unreachable",
        }

    # ── APScheduler — cleanup expired temp files ───────────────────────────────
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        run_cleanup,
        trigger="interval",
        minutes=settings.temp_cleanup_interval_minutes,
        id="cleanup_expired_files",
        replace_existing=True,
        max_instances=1,
    )

    @app.on_event("startup")
    def start_scheduler():
        scheduler.start()
        logger.info(
            "scheduler_started",
            interval_minutes=settings.temp_cleanup_interval_minutes,
        )

    @app.on_event("shutdown")
    def stop_scheduler():
        scheduler.shutdown(wait=False)
        logger.info("scheduler_stopped")

    logger.info(
        "app_created",
        env=settings.app_env,
        frontend_url=settings.frontend_url,
        google_configured=settings.google_configured,
        r2_configured=settings.r2_configured,
    )
    return app


app = create_app()
