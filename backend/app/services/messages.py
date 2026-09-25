"""Message business logic.

Every query filters on the owner, so a message that belongs to someone else is
indistinguishable from one that does not exist.
"""

import uuid
from collections.abc import Sequence

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.core.identity import CurrentUser
from app.models import Message
from app.schemas.message import MessageCreate

MESSAGE_NOT_FOUND = "Message not found."


def list_messages(db: Session, owner: CurrentUser) -> Sequence[Message]:
    """The owner's messages, newest first (served by ix_messages_user_id_created_at)."""
    return db.scalars(
        select(Message)
        .where(Message.user_id == owner.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
    ).all()


def get_message(db: Session, owner: CurrentUser, message_id: uuid.UUID) -> Message:
    message = db.scalars(
        select(Message).where(Message.id == message_id, Message.user_id == owner.id)
    ).one_or_none()
    if message is None:
        raise NotFoundError(MESSAGE_NOT_FOUND)
    return message


def create_message(db: Session, owner: CurrentUser, data: MessageCreate) -> Message:
    """Persist a new message for ``owner``.

    Ownership comes from the resolved identity, never from the payload, and
    ``created_at`` is assigned by the database.
    """
    message = Message(user_id=owner.id, subject=data.subject, text=data.text)
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


def delete_message(db: Session, owner: CurrentUser, message_id: uuid.UUID) -> None:
    result = db.execute(
        delete(Message)
        .where(Message.id == message_id, Message.user_id == owner.id)
        .returning(Message.id)
    )
    if result.scalar_one_or_none() is None:
        db.rollback()
        raise NotFoundError(MESSAGE_NOT_FOUND)
    db.commit()
