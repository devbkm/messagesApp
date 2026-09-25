import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.message import SUBJECT_MAX_LENGTH, Message

Subject = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=SUBJECT_MAX_LENGTH)
]
Body = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


class MessageCreate(BaseModel):
    """Client payload for creating a message.

    Deliberately excludes ``user_id``, ``id`` and ``created_at``: the server owns
    them. Unknown fields are rejected rather than silently ignored.
    """

    model_config = ConfigDict(extra="forbid")

    subject: Subject
    text: Body


class AttachmentRead(BaseModel):
    filename: str
    content_type: str
    size_bytes: int = Field(ge=0)


class MessageRead(BaseModel):
    """A message as returned to its owner. ``user_id`` is not exposed."""

    id: uuid.UUID
    subject: str
    text: str
    created_at: datetime
    attachment: AttachmentRead | None = None

    @classmethod
    def from_model(cls, message: Message) -> "MessageRead":
        attachment = None
        if message.attachment_filename is not None:
            attachment = AttachmentRead(
                filename=message.attachment_filename,
                content_type=message.attachment_content_type or "application/octet-stream",
                size_bytes=message.attachment_size_bytes or 0,
            )
        return cls(
            id=message.id,
            subject=message.subject,
            text=message.text,
            created_at=message.created_at,
            attachment=attachment,
        )
