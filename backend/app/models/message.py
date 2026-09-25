import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Uuid,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.user import User

SUBJECT_MAX_LENGTH = 40
ATTACHMENT_FILENAME_MAX_LENGTH = 255
ATTACHMENT_CONTENT_TYPE_MAX_LENGTH = 127


class Message(Base):
    """A message owned by exactly one user.

    Integrity rules are enforced by the database as well as by the API layer, so no
    code path (scripts, future endpoints, bugs) can store an invalid message.
    """

    __tablename__ = "messages"
    __table_args__ = (
        CheckConstraint("char_length(btrim(subject)) > 0", name="subject_not_blank"),
        CheckConstraint(f"char_length(subject) <= {SUBJECT_MAX_LENGTH}", name="subject_max_length"),
        CheckConstraint("char_length(btrim(text)) > 0", name="text_not_blank"),
        # Attachment metadata is all-or-nothing, and a size cannot be negative.
        CheckConstraint(
            "(attachment_filename IS NULL AND attachment_content_type IS NULL"
            " AND attachment_size_bytes IS NULL)"
            " OR (attachment_filename IS NOT NULL AND attachment_content_type IS NOT NULL"
            " AND attachment_size_bytes IS NOT NULL AND attachment_size_bytes >= 0)",
            name="attachment_complete",
        ),
        # Serves the inbox query: WHERE user_id = ? ORDER BY created_at DESC.
        # Its leading column also covers lookups and FK checks on user_id alone.
        Index("ix_messages_user_id_created_at", "user_id", text("created_at DESC")),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(SUBJECT_MAX_LENGTH), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # Set by the database clock (timestamptz, UTC); never supplied by a client.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # Optional attachment metadata. File storage itself is outside the current scope.
    attachment_filename: Mapped[str | None] = mapped_column(String(ATTACHMENT_FILENAME_MAX_LENGTH))
    attachment_content_type: Mapped[str | None] = mapped_column(
        String(ATTACHMENT_CONTENT_TYPE_MAX_LENGTH)
    )
    attachment_size_bytes: Mapped[int | None] = mapped_column(Integer)

    user: Mapped["User"] = relationship(back_populates="messages")
