"""Add accounts (name, email, password hash) and server-side sessions.

Revision ID: 6ae3ebb93a2f
Revises: 867411616f93
Create Date: 2026-09-25 17:10:00

Migration strategy for existing data (non-destructive):

- ``messages.user_id`` already references ``users.id`` with ``NOT NULL``, so every
  existing message already has an owner. No message is deleted or reassigned.
- Existing users were identified by id only. Their new ``name``, ``email`` and
  ``password_hash`` columns stay NULL: they keep their messages but cannot sign in. A
  check constraint allows either all three credentials or none, so new accounts are
  always complete.
- ``updated_at`` is added with a ``now()`` default, which fills existing rows.
- Downgrading drops only what this revision added.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "6ae3ebb93a2f"
down_revision: str | Sequence[str] | None = "867411616f93"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- users: optional credentials for pre-existing id-only accounts -------------
    op.add_column("users", sa.Column("name", sa.String(length=100), nullable=True))
    op.add_column("users", sa.Column("email", sa.String(length=254), nullable=True))
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))
    op.add_column(
        "users",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_unique_constraint(op.f("uq_users_email"), "users", ["email"])
    op.create_check_constraint(
        op.f("ck_users_credentials_complete"),
        "users",
        "(name IS NULL AND email IS NULL AND password_hash IS NULL)"
        " OR (name IS NOT NULL AND email IS NOT NULL AND password_hash IS NOT NULL)",
    )
    op.create_check_constraint(op.f("ck_users_email_lowercase"), "users", "email = lower(email)")

    # --- messages ------------------------------------------------------------------
    op.add_column(
        "messages",
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )

    # --- sessions: only the SHA-256 digest of each token is stored -----------------
    op.create_table(
        "sessions",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("token_hash", sa.String(length=64), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_sessions_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_sessions")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_sessions_token_hash")),
    )
    op.create_index(op.f("ix_sessions_user_id"), "sessions", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_sessions_user_id"), table_name="sessions")
    op.drop_table("sessions")
    op.drop_column("messages", "updated_at")
    op.drop_constraint(op.f("ck_users_email_lowercase"), "users", type_="check")
    op.drop_constraint(op.f("ck_users_credentials_complete"), "users", type_="check")
    op.drop_constraint(op.f("uq_users_email"), "users", type_="unique")
    op.drop_column("users", "updated_at")
    op.drop_column("users", "password_hash")
    op.drop_column("users", "email")
    op.drop_column("users", "name")
