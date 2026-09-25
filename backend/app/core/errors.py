"""Consistent JSON error responses.

Every error returned by the API has the shape::

    {"error": {"code": "<machine_readable>", "message": "<human readable>", "details": [...]}}

``details`` is only present for validation errors. Unexpected exceptions are logged
server-side and returned as a generic 500 so internal details never leak to clients.
"""

import logging
from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InterfaceError, OperationalError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger(__name__)


class AppError(Exception):
    """An expected failure with a safe, user-facing message and a stable code."""

    status_code = status.HTTP_400_BAD_REQUEST
    code = "bad_request"

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code


class NotFoundError(AppError):
    """Raised by services when a resource does not exist *for the current user*.

    The same error is used whether the resource is missing or owned by someone else,
    so responses never reveal that another user's resource exists.
    """

    status_code = status.HTTP_404_NOT_FOUND
    code = "not_found"

    def __init__(self, message: str = "Not found.") -> None:
        super().__init__(message)


class AuthenticationError(AppError):
    """Missing, invalid or expired credentials (401)."""

    status_code = status.HTTP_401_UNAUTHORIZED
    code = "not_authenticated"


class ConflictError(AppError):
    """The request conflicts with existing data, e.g. an email already registered (409)."""

    status_code = status.HTTP_409_CONFLICT
    code = "conflict"


_STATUS_CODES: dict[int, str] = {
    status.HTTP_400_BAD_REQUEST: "bad_request",
    status.HTTP_401_UNAUTHORIZED: "unauthorized",
    status.HTTP_403_FORBIDDEN: "forbidden",
    status.HTTP_404_NOT_FOUND: "not_found",
    status.HTTP_405_METHOD_NOT_ALLOWED: "method_not_allowed",
    status.HTTP_409_CONFLICT: "conflict",
    status.HTTP_422_UNPROCESSABLE_CONTENT: "validation_error",
}


def error_body(code: str, message: str, details: list[Any] | None = None) -> dict[str, Any]:
    error: dict[str, Any] = {"code": code, "message": message}
    if details is not None:
        error["details"] = details
    return {"error": error}


async def _http_exception_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
    code = _STATUS_CODES.get(exc.status_code, "http_error")
    message = exc.detail if isinstance(exc.detail, str) else "Request failed."
    return JSONResponse(
        status_code=exc.status_code,
        content=error_body(code, message),
        headers=getattr(exc, "headers", None),
    )


async def _validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Only expose where and why validation failed; never echo the submitted input back.
    details = [
        {"field": ".".join(str(part) for part in err.get("loc", ())), "message": err.get("msg")}
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content=jsonable_encoder(
            error_body("validation_error", "The request is invalid.", details)
        ),
    )


async def _app_error_handler(_: Request, exc: AppError) -> JSONResponse:
    headers = (
        {"WWW-Authenticate": "Bearer"} if exc.status_code == status.HTTP_401_UNAUTHORIZED else None
    )
    return JSONResponse(
        status_code=exc.status_code, content=error_body(exc.code, exc.message), headers=headers
    )


async def _database_exception_handler(request: Request, exc: SQLAlchemyError) -> JSONResponse:
    # SQL, parameters and driver messages are logged, never returned.
    logger.exception("Database error on %s %s", request.method, request.url.path, exc_info=exc)
    # OperationalError / InterfaceError: the database is unreachable or dropped the
    # connection, which is transient from the client's point of view.
    if isinstance(exc, OperationalError | InterfaceError):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=error_body(
                "service_unavailable", "The service is temporarily unavailable. Please try again."
            ),
        )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_body("internal_error", "Something went wrong. Please try again."),
    )


async def _unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s %s", request.method, request.url.path, exc_info=exc)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_body("internal_error", "Something went wrong. Please try again."),
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(StarletteHTTPException, _http_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(RequestValidationError, _validation_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(AppError, _app_error_handler)  # type: ignore[arg-type]
    app.add_exception_handler(SQLAlchemyError, _database_exception_handler)  # type: ignore[arg-type]
    app.add_exception_handler(Exception, _unhandled_exception_handler)
