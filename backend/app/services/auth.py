"""Account and session business logic."""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError, ConflictError
from app.core.security import (
    hash_password,
    hash_token,
    needs_rehash,
    new_session_token,
    verify_password,
)
from app.models import User, UserSession
from app.schemas.auth import LoginRequest, SignupRequest

INVALID_CREDENTIALS = "Invalid email or password."
SESSION_EXPIRED = "Your session has expired. Please log in again."
SESSION_INVALID = "Your session is no longer valid. Please log in again."


@dataclass(frozen=True, slots=True)
class IssuedSession:
    user: User
    token: str
    expires_at: datetime


def signup(db: Session, data: SignupRequest, ttl: timedelta) -> IssuedSession:
    """Create an account and sign it in, so no separate login is needed afterwards."""
    if db.scalar(select(User.id).where(User.email == data.email)) is not None:
        raise ConflictError("An account with this email already exists.", code="email_taken")

    user = User(name=data.name, email=data.email, password_hash=hash_password(data.password))
    db.add(user)
    try:
        db.flush()
    except IntegrityError:
        # Lost a race with a concurrent sign-up for the same email.
        db.rollback()
        raise ConflictError(
            "An account with this email already exists.", code="email_taken"
        ) from None
    return _issue_session(db, user, ttl)


def login(db: Session, data: LoginRequest, ttl: timedelta) -> IssuedSession:
    """Verify credentials. Unknown email and wrong password give the same answer."""
    user = db.scalars(select(User).where(User.email == data.email)).one_or_none()
    stored_hash = user.password_hash if user else None
    # verify_password also runs for unknown emails, so timing reveals nothing.
    valid = verify_password(stored_hash, data.password)
    if user is None or stored_hash is None or not valid:
        raise AuthenticationError(INVALID_CREDENTIALS, code="invalid_credentials")

    if needs_rehash(stored_hash):
        user.password_hash = hash_password(data.password)
    # Housekeeping: drop this user's expired sessions.
    db.execute(
        delete(UserSession).where(
            UserSession.user_id == user.id, UserSession.expires_at <= func.now()
        )
    )
    return _issue_session(db, user, ttl)


def resolve_session(db: Session, token: str) -> User:
    """The user behind a session token, or an AuthenticationError."""
    session = db.scalars(
        select(UserSession).where(UserSession.token_hash == hash_token(token))
    ).one_or_none()
    if session is None:
        raise AuthenticationError(SESSION_INVALID, code="invalid_session")
    if session.expires_at <= datetime.now(UTC):
        db.delete(session)
        db.commit()
        raise AuthenticationError(SESSION_EXPIRED, code="session_expired")
    return session.user


def logout(db: Session, token: str) -> None:
    """End the session on the server. Unknown or expired tokens are ignored."""
    db.execute(delete(UserSession).where(UserSession.token_hash == hash_token(token)))
    db.commit()


def _issue_session(db: Session, user: User, ttl: timedelta) -> IssuedSession:
    token = new_session_token()
    expires_at = datetime.now(UTC) + ttl
    db.add(UserSession(user=user, token_hash=hash_token(token), expires_at=expires_at))
    db.commit()
    db.refresh(user)
    return IssuedSession(user=user, token=token, expires_at=expires_at)
