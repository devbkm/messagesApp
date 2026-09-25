"""Service layer, input schema and current-user resolution."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.identity import CurrentUser, get_current_user
from app.models import Message, User
from app.schemas.message import MessageCreate, MessageRead
from app.services.messages import create_message
from app.services.users import get_or_create_user

# --- Users -------------------------------------------------------------------------


def test_get_or_create_user_creates_once(db: Session) -> None:
    user_id = uuid.uuid4()

    first = get_or_create_user(db, user_id)
    second = get_or_create_user(db, user_id)

    assert first.id == second.id == user_id
    assert db.scalar(select(func.count()).select_from(User).where(User.id == user_id)) == 1


# --- Message creation ----------------------------------------------------------------


def test_create_message_assigns_owner_and_server_timestamp(db: Session) -> None:
    owner = CurrentUser(id=get_or_create_user(db, uuid.uuid4()).id)

    message = create_message(db, owner, MessageCreate(subject="  Hi  ", text="Body"))

    assert message.user_id == owner.id
    assert message.subject == "Hi"
    assert abs(datetime.now(UTC) - message.created_at) < timedelta(minutes=1)
    assert db.get(Message, message.id) is not None


def test_message_read_does_not_expose_owner(db: Session) -> None:
    owner = CurrentUser(id=get_or_create_user(db, uuid.uuid4()).id)
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


def test_current_user_is_resolved_and_provisioned(db: Session) -> None:
    user_id = uuid.uuid4()

    current = get_current_user(db, str(user_id))

    assert current == CurrentUser(id=user_id)
    assert db.get(User, user_id) is not None


@pytest.mark.parametrize("header", [None, "", "not-a-uuid"])
def test_current_user_requires_a_valid_identifier(db: Session, header: str | None) -> None:
    with pytest.raises(HTTPException) as exc_info:
        get_current_user(db, header)

    assert exc_info.value.status_code == 401
