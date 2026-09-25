"""Database-level integrity: the schema itself rejects invalid data."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.orm import Session

from app.models import Message, User


def make_user(db: Session) -> User:
    user = User()
    db.add(user)
    db.flush()
    return user


def add_message(db: Session, **overrides: object) -> Message:
    values: dict[str, object] = {"subject": "Hello", "text": "Body"}
    values.update(overrides)
    message = Message(**values)
    db.add(message)
    db.flush()
    return message


# --- Users -------------------------------------------------------------------------


def test_user_gets_generated_id_and_utc_creation_time(db: Session) -> None:
    user = make_user(db)
    db.refresh(user)

    assert isinstance(user.id, uuid.UUID)
    assert user.created_at.utcoffset() == timedelta(0)
    assert abs(datetime.now(UTC) - user.created_at) < timedelta(minutes=1)


# --- Messages ----------------------------------------------------------------------


def test_message_is_stored_with_server_generated_fields(db: Session) -> None:
    user = make_user(db)
    message = add_message(db, user_id=user.id)
    db.refresh(message)

    assert isinstance(message.id, uuid.UUID)
    assert message.user_id == user.id
    assert message.created_at.utcoffset() == timedelta(0)
    assert message.attachment_filename is None


def test_subject_of_exactly_40_characters_is_accepted(db: Session) -> None:
    user = make_user(db)
    # Non-ASCII characters count as one character each, not per byte.
    message = add_message(db, user_id=user.id, subject="é" * 40)

    assert len(message.subject) == 40


def test_subject_longer_than_40_characters_is_rejected(db: Session) -> None:
    user = make_user(db)

    with pytest.raises(DataError):
        add_message(db, user_id=user.id, subject="x" * 41)


@pytest.mark.parametrize("field", ["subject", "text"])
def test_blank_subject_or_text_is_rejected(db: Session, field: str) -> None:
    user = make_user(db)

    with pytest.raises(IntegrityError, match=f"ck_messages_{field}_not_blank"):
        add_message(db, user_id=user.id, **{field: "   "})


@pytest.mark.parametrize("field", ["subject", "text", "user_id"])
def test_required_fields_cannot_be_null(db: Session, field: str) -> None:
    user = make_user(db)
    values: dict[str, object] = {"user_id": user.id, field: None}

    with pytest.raises(IntegrityError, match="not-null"):
        add_message(db, **values)


def test_message_must_belong_to_an_existing_user(db: Session) -> None:
    with pytest.raises(IntegrityError, match="fk_messages_user_id_users"):
        add_message(db, user_id=uuid.uuid4())


def test_partial_attachment_metadata_is_rejected(db: Session) -> None:
    user = make_user(db)

    with pytest.raises(IntegrityError, match="ck_messages_attachment_complete"):
        add_message(db, user_id=user.id, attachment_filename="notes.pdf")


def test_complete_attachment_metadata_is_accepted(db: Session) -> None:
    user = make_user(db)
    message = add_message(
        db,
        user_id=user.id,
        attachment_filename="notes.pdf",
        attachment_content_type="application/pdf",
        attachment_size_bytes=1024,
    )

    assert message.attachment_size_bytes == 1024


# --- Relationships -----------------------------------------------------------------


def test_user_and_message_relationship(db: Session) -> None:
    user = make_user(db)
    first = add_message(db, user_id=user.id, subject="First")
    second = add_message(db, user_id=user.id, subject="Second")
    other_user = make_user(db)
    add_message(db, user_id=other_user.id, subject="Not mine")
    db.expire_all()

    assert {m.id for m in db.get_one(User, user.id).messages} == {first.id, second.id}
    assert db.get_one(Message, first.id).user.id == user.id


def test_deleting_a_user_deletes_their_messages(db: Session) -> None:
    user = make_user(db)
    message = add_message(db, user_id=user.id)

    db.delete(user)
    db.flush()

    assert db.scalars(select(Message).where(Message.id == message.id)).first() is None
