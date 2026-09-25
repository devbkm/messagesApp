"""Sign-up, login, logout and the current user."""

from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.identity import (
    AUTH_TRANSPORT_HEADER,
    SESSION_COOKIE,
    CurrentUser,
    get_current_user,
    get_session_token,
)
from app.db.session import get_db
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest, UserRead
from app.schemas.error import error_responses
from app.services import auth as auth_service
from app.services.auth import IssuedSession

DbSession = Annotated[Session, Depends(get_db)]
AppSettings = Annotated[Settings, Depends(get_settings)]
Transport = Annotated[
    str | None,
    Header(
        alias=AUTH_TRANSPORT_HEADER,
        description="Send `cookie` (web) to receive the session as an httpOnly cookie.",
    ),
]

# The cookie is only needed by the API, so it is scoped to it.
COOKIE_PATH = "/api/v1"

router = APIRouter(prefix="/auth", tags=["auth"], responses=error_responses(422, 503))


def _respond(
    issued: IssuedSession, transport: str | None, response: Response, settings: Settings
) -> AuthResponse:
    user = issued.user
    body = AuthResponse(
        user=UserRead(
            id=user.id, name=user.name or "", email=user.email or "", created_at=user.created_at
        ),
        expires_at=issued.expires_at,
    )
    if transport == "cookie":
        response.set_cookie(
            SESSION_COOKIE,
            issued.token,
            expires=issued.expires_at,
            path=COOKIE_PATH,
            httponly=True,
            secure=settings.session_cookie_secure,
            samesite="lax",
        )
    else:
        body.token = issued.token
    return body


@router.post(
    "/signup",
    response_model=AuthResponse,
    response_model_exclude_none=True,
    status_code=status.HTTP_201_CREATED,
    summary="Create an account and sign in",
    responses={
        **error_responses(422),
        409: {"description": "An account with this email already exists (`email_taken`)."},
    },
)
def signup(
    data: SignupRequest,
    response: Response,
    db: DbSession,
    settings: AppSettings,
    transport: Transport = None,
) -> AuthResponse:
    issued = auth_service.signup(db, data, timedelta(days=settings.session_ttl_days))
    return _respond(issued, transport, response, settings)


@router.post(
    "/login",
    response_model=AuthResponse,
    response_model_exclude_none=True,
    summary="Sign in with email and password",
    responses={
        **error_responses(422),
        401: {"description": "Invalid email or password (`invalid_credentials`)."},
    },
)
def login(
    data: LoginRequest,
    response: Response,
    db: DbSession,
    settings: AppSettings,
    transport: Transport = None,
) -> AuthResponse:
    issued = auth_service.login(db, data, timedelta(days=settings.session_ttl_days))
    return _respond(issued, transport, response, settings)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="End the current session",
    description="Deletes the session on the server and clears the web cookie. Always succeeds.",
)
def logout(
    db: DbSession,
    settings: AppSettings,
    token: Annotated[str | None, Depends(get_session_token)],
) -> Response:
    if token:
        auth_service.logout(db, token)
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(
        SESSION_COOKIE,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="lax",
    )
    return response


@router.get(
    "/me",
    response_model=UserRead,
    summary="The signed-in user",
    responses=error_responses(401),
)
def me(user: Annotated[CurrentUser, Depends(get_current_user)]) -> UserRead:
    return UserRead(id=user.id, name=user.name, email=user.email, created_at=user.created_at)
