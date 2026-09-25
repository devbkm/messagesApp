"""Current-user resolution from a session token.

Business logic depends only on :class:`CurrentUser`; it never inspects requests,
headers, cookies or tokens. :func:`get_current_user` is the single place that turns a
request into a user.

Two transports carry the same opaque session token:

- ``Authorization: Bearer <token>``: used by the mobile app, which keeps the token in
  the device's secure storage.
- The ``inbox_session`` httpOnly cookie: used by the web app, so JavaScript never sees
  the token. The cookie is only honoured when the request also carries
  ``X-Auth-Transport: cookie``. A cross-site page cannot add that custom header without
  a CORS preflight, which the origin allow-list refuses, so cookie authentication cannot
  be abused for cross-site request forgery.
"""

import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated

from fastapi import Depends, Header, Security
from fastapi.security import APIKeyCookie, HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError
from app.db.session import get_db
from app.services import auth as auth_service

SESSION_COOKIE = "inbox_session"
AUTH_TRANSPORT_HEADER = "X-Auth-Transport"

bearer_scheme = HTTPBearer(
    scheme_name="BearerToken",
    description="Session token returned by sign-up/login (native clients).",
    auto_error=False,
)
cookie_scheme = APIKeyCookie(
    name=SESSION_COOKIE,
    scheme_name="SessionCookie",
    description=f"Web session cookie; requires the `{AUTH_TRANSPORT_HEADER}: cookie` header.",
    auto_error=False,
)


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """The authenticated caller, as seen by business logic."""

    id: uuid.UUID
    name: str
    email: str
    created_at: datetime


def get_session_token(
    bearer: Annotated[HTTPAuthorizationCredentials | None, Security(bearer_scheme)] = None,
    cookie: Annotated[str | None, Security(cookie_scheme)] = None,
    transport: Annotated[str | None, Header(alias=AUTH_TRANSPORT_HEADER)] = None,
) -> str | None:
    """The session token from the Authorization header, or from the cookie for web clients."""
    if bearer is not None and bearer.credentials:
        return bearer.credentials
    if transport == "cookie" and cookie:
        return cookie
    return None


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    token: Annotated[str | None, Depends(get_session_token)],
) -> CurrentUser:
    if not token:
        raise AuthenticationError("Please log in to continue.")
    user = auth_service.resolve_session(db, token)
    if user.name is None or user.email is None:
        # Legacy id-only accounts can never obtain a session; refuse defensively.
        raise AuthenticationError(auth_service.SESSION_INVALID, code="invalid_session")
    return CurrentUser(id=user.id, name=user.name, email=user.email, created_at=user.created_at)
