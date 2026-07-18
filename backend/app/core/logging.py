"""
Structlog configuration.
Call configure_logging() once at application startup (in main.py).
Afterwards, get a logger anywhere with:  logger = structlog.get_logger()
"""

import logging

import structlog


def configure_logging(is_production: bool = False) -> None:
    """
    Set up structlog with:
      - JSON output in production (machine-readable)
      - Pretty console output in development (human-readable, coloured)
      - Request-ID binding via contextvars (populated by RequestIDMiddleware)
    """
    shared_processors: list = [
        # Merge any context bound via structlog.contextvars.bind_contextvars()
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.ExceptionRenderer(),
    ]

    renderer = (
        structlog.processors.JSONRenderer()
        if is_production
        else structlog.dev.ConsoleRenderer(colors=True)
    )

    structlog.configure(
        processors=shared_processors + [renderer],
        wrapper_class=structlog.make_filtering_bound_logger(
            logging.INFO if is_production else logging.DEBUG
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Also configure stdlib logging so third-party libraries go through the
    # same output stream (SQLAlchemy, APScheduler, etc.)
    logging.basicConfig(
        format="%(message)s",
        level=logging.INFO if is_production else logging.DEBUG,
        force=True,
    )
