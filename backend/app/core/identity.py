"""Current-user resolution.

Business logic depends only on :class:`CurrentUser`; it never inspects requests,
headers or tokens. Replacing the development scheme below with JWT/OAuth means
rewriting :func:`get_current_user` only: verify the token, map its subject to a
``User`` row, and return a ``CurrentUser``. Services and routes stay unchanged.

Development scheme (deliberately simple, as allowed by the exercise): the client
sends an opaque user id in the ``X-User-Id`` header. It identifies the caller but
does **not** authenticate them; it is not suitable for production.
"""

import uuid
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.services import users as user_service

USER_ID_HEADER = "X-User-Id"


@dataclass(frozen=True, slots=True)
class CurrentUser:
    """The authenticated caller, as seen by business logic."""

    id: uuid.UUID


def get_current_user(
    db: Annotated[Session, Depends(get_db)],
    x_user_id: Annotated[str | None, Header(alias=USER_ID_HEADER)] = None,
) -> CurrentUser:
    if x_user_id is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing user identification.")
    try:
        user_id = uuid.UUID(x_user_id)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid user identification.") from None

    user = user_service.get_or_create_user(db, user_id)
    return CurrentUser(id=user.id)
