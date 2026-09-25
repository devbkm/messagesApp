import uuid
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from app.models.message import SUBJECT_MAX_LENGTH, Message

# The brief sets no limit for the text; this bound only protects the API from
# unreasonably large payloads.
TEXT_MAX_LENGTH = 10_000

Subject = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=SUBJECT_MAX_LENGTH),
    Field(
        description=(
            f"Required. 1-{SUBJECT_MAX_LENGTH} characters after trimming surrounding whitespace."
        ),
        examples=["Example"],
    ),
]
Body = Annotated[
    str,
    StringConstraints(strip_whitespace=True, min_length=1, max_length=TEXT_MAX_LENGTH),
    Field(
        description=(
            f"Required. 1-{TEXT_MAX_LENGTH:,} characters after trimming surrounding whitespace."
        ),
        examples=["Message content"],
    ),
]


class MessageCreate(BaseModel):
    """Client payload for creating a message.

    Deliberately excludes ``id``, ``user_id`` and ``created_at``: the server owns
    them. Unknown fields are rejected rather than silently ignored.
    """

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={"examples": [{"subject": "Example", "text": "Message content"}]},
    )

    subject: Subject
    text: Body


class AttachmentRead(BaseModel):
    filename: str
    content_type: str
    size_bytes: int = Field(ge=0)


class MessageSummary(BaseModel):
    """A message as shown in the inbox list."""

    id: uuid.UUID
    subject: str
    created_at: datetime = Field(description="Creation time in UTC (ISO 8601), set by the server.")
    has_attachment: bool

    @classmethod
    def from_model(cls, message: Message) -> "MessageSummary":
        return cls(
            id=message.id,
            subject=message.subject,
            created_at=message.created_at,
            has_attachment=message.attachment_filename is not None,
        )


class MessageList(BaseModel):
    """The current user's messages, newest first."""

    items: list[MessageSummary]


class MessageRead(BaseModel):
    """A message as returned to its owner. ``user_id`` is never exposed."""

    id: uuid.UUID
    subject: str
    text: str
    created_at: datetime = Field(description="Creation time in UTC (ISO 8601), set by the server.")
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
