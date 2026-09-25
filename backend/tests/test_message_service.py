"""Service layer, input schema and current-user resolution."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import AuthenticationError
from app.core.identity import CurrentUser, get_current_user
from app.models import Message, UserSession
from app.schemas.auth import SignupRequest
from app.schemas.message import MessageCreate, MessageRead
from app.services import auth as auth_service
from app.services.messages import create_message
from tests.support import signup_payload

TTL = timedelta(days=1)


def new_account(db: Session) -> auth_service.IssuedSession:
    return auth_service.signup(db, SignupRequest(**signup_payload()), TTL)


def as_current_user(issued: auth_service.IssuedSession) -> CurrentUser:
    user = issued.user
    assert user.name is not None and user.email is not None
    return CurrentUser(id=user.id, name=user.name, email=user.email, created_at=user.created_at)


# --- Message creation ----------------------------------------------------------------


def test_create_message_assigns_owner_and_server_timestamp(db: Session) -> None:
    owner = as_current_user(new_account(db))

    message = create_message(db, owner, MessageCreate(subject="  Hi  ", text="Body"))

    assert message.user_id == owner.id
    assert message.subject == "Hi"
    assert abs(datetime.now(UTC) - message.created_at) < timedelta(minutes=1)
    assert message.updated_at == message.created_at
    assert db.get(Message, message.id) is not None


def test_message_read_does_not_expose_owner(db: Session) -> None:
    owner = as_current_user(new_account(db))
    message = create_message(db, owner, MessageCreate(subject="Hi", text="Body"))

    payload = MessageRead.from_model(message).model_dump()

    assert "user_id" not in payload
    assert payload["attachment"] is None


# --- Input schema ------------------------------------------------------------------


@pytest.mark.parametrize("field", ["user_id", "created_at", "id"])
def test_create_payload_rejects_server_owned_fields(field: str) -> None:
    with pytest.raises(ValidationError, match="Extra inputs are not permitted"):
        MessageCreate.model_validate({"subject": "Hi", "text": "Body", field: "anything"})


@pytest.mark.parametrize(
    "payload",
    [
        {"text": "Body"},
        {"subject": "Hi"},
        {"subject": "   ", "text": "Body"},
        {"subject": "Hi", "text": ""},
        {"subject": "x" * 41, "text": "Body"},
    ],
    ids=["missing-subject", "missing-text", "blank-subject", "empty-text", "subject-41"],
)
def test_create_payload_validation(payload: dict[str, str]) -> None:
    with pytest.raises(ValidationError):
        MessageCreate.model_validate(payload)


def test_subject_limit_applies_after_trimming() -> None:
    data = MessageCreate(subject=f"  {'x' * 40}  ", text="Body")

    assert data.subject == "x" * 40


# --- Current user ------------------------------------------------------------------


def test_current_user_is_resolved_from_a_session_token(db: Session) -> None:
    issued = new_account(db)

    current = get_current_user(db, issued.token)

    assert current == as_current_user(issued)


@pytest.mark.parametrize(
    ("token", "code"),
    [(None, "not_authenticated"), ("", "not_authenticated"), ("unknown", "invalid_session")],
)
def test_current_user_requires_a_valid_session(db: Session, token: str | None, code: str) -> None:
    with pytest.raises(AuthenticationError) as exc_info:
        get_current_user(db, token)

    assert exc_info.value.status_code == 401
    assert exc_info.value.code == code


def test_session_tokens_are_stored_only_as_hashes(db: Session) -> None:
    issued = new_account(db)

    stored = db.scalars(select(UserSession).where(UserSession.user_id == issued.user.id)).one()

    assert stored.token_hash != issued.token
    assert issued.token not in stored.token_hash
    assert len(stored.token_hash) == 64
