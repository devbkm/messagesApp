"""Message business logic. Every operation is scoped to the calling user."""

from sqlalchemy.orm import Session

from app.core.identity import CurrentUser
from app.models import Message
from app.schemas.message import MessageCreate


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
