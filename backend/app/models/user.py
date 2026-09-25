import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, String, Uuid, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base

if TYPE_CHECKING:
    from app.models.message import Message
    from app.models.session import UserSession

NAME_MAX_LENGTH = 100
EMAIL_MAX_LENGTH = 254


class User(Base):
    """An account that owns messages.

    ``name``, ``email`` and ``password_hash`` are nullable only for accounts created
    before sign-up existed (identified by id alone). Those rows keep their messages but
    cannot sign in; a check constraint guarantees a row has either all credentials or
    none. The raw password is never stored.
    """

    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint(
            "(name IS NULL AND email IS NULL AND password_hash IS NULL)"
            " OR (name IS NOT NULL AND email IS NOT NULL AND password_hash IS NOT NULL)",
            name="credentials_complete",
        ),
        # Emails are normalised to lower case, so the unique constraint is case-insensitive.
        CheckConstraint("email = lower(email)", name="email_lowercase"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid, primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()")
    )
    name: Mapped[str | None] = mapped_column(String(NAME_MAX_LENGTH))
    email: Mapped[str | None] = mapped_column(String(EMAIL_MAX_LENGTH), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(255))
    # Set by the database clock (timestamptz, UTC); never supplied by a client.
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    messages: Mapped[list["Message"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
    sessions: Mapped[list["UserSession"]] = relationship(
        back_populates="user", cascade="all, delete-orphan", passive_deletes=True
    )
