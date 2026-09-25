"""FastAPI application factory and ASGI entry point (``uvicorn app.main:app``)."""

import logging
from collections.abc import Awaitable, Callable

from fastapi import FastAPI, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.router import API_V1_PREFIX, api_v1_router
from app.api.routes import health
from app.core.config import Settings, get_settings
from app.core.errors import error_body, register_exception_handlers
from app.core.identity import USER_ID_HEADER

# Largest accepted request body. A maximal valid message (10,000 characters, even if
# every one is JSON-escaped) is well below this; anything larger is rejected before
# it is read into memory.
MAX_BODY_BYTES = 256 * 1024


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()
    logging.basicConfig(level=settings.log_level.upper())

    app = FastAPI(
        title=settings.app_name,
        version="1.0.0",
        # Interactive docs are useful locally but not exposed in production.
        docs_url=None if settings.is_production else "/docs",
        redoc_url=None,
        openapi_url=None if settings.is_production else "/openapi.json",
        description=(
            "Inbox API. Every `/api/v1/messages` operation is scoped to the caller "
            "identified by the `X-User-Id` header. Errors share one envelope: "
            '`{"error": {"code", "message", "details"?}}`.'
        ),
    )

    @app.middleware("http")
    async def limit_body_size(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        if request.method in {"POST", "PUT", "PATCH"}:
            length = request.headers.get("content-length")
            if length is None or not length.isdigit():
                # Without a declared length the size cannot be checked up front.
                return JSONResponse(
                    status_code=status.HTTP_411_LENGTH_REQUIRED,
                    content=error_body("length_required", "A Content-Length header is required."),
                )
            if int(length) > MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_CONTENT_TOO_LARGE,
                    content=error_body("payload_too_large", "The request body is too large."),
                )
        return await call_next(request)

    # Registered last, so it is the outer layer and also applies to the responses above.
    @app.middleware("http")
    async def security_headers(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        if request.url.path.startswith(API_V1_PREFIX):
            # Responses contain private, per-user data: never cache them.
            response.headers.setdefault("Cache-Control", "no-store")
        return response

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST", "DELETE"],
            allow_headers=["Content-Type", USER_ID_HEADER],
        )

    register_exception_handlers(app)
    app.include_router(health.router)
    app.include_router(api_v1_router)
    return app


app = create_app()
