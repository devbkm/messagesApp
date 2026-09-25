"""Error response models. They document the envelope built in ``app.core.errors``."""

from typing import Any

from pydantic import BaseModel, Field


class FieldError(BaseModel):
    field: str = Field(examples=["body.subject"])
    message: str = Field(examples=["String should have at most 40 characters"])


class ErrorDetail(BaseModel):
    code: str = Field(
        description="Stable, machine-readable error code.",
        examples=["not_found"],
    )
    message: str = Field(description="Human-readable summary, safe to show to users.")
    details: list[FieldError] | None = Field(
        default=None, description="Per-field problems; only present for validation errors."
    )


class ErrorResponse(BaseModel):
    error: ErrorDetail


def error_responses(*status_codes: int) -> dict[int | str, dict[str, Any]]:
    """OpenAPI ``responses`` entries for the given error status codes."""
    descriptions = {
        401: "Not signed in, or the session is invalid or expired.",
        404: "The message does not exist or does not belong to the current user.",
        422: "The request is invalid (see `details`).",
        503: "The service is temporarily unavailable.",
    }
    return {
        code: {"model": ErrorResponse, "description": descriptions[code]} for code in status_codes
    }
