"""Create users and messages.

Revision ID: 867411616f93
Revises:
Create Date: 2026-09-25 09:08:02.260833

Integrity rules live in the database as well as in the API:
- every message has a non-null owner (FK to users, cascading on user deletion);
- subject is 1-40 characters and not blank; text is not blank;
- created_at is assigned by the database (timestamptz, UTC);
- attachment metadata is all-or-nothing with a non-negative size.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "867411616f93"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
    )
    op.create_table(
        "messages",
        sa.Column("id", sa.Uuid(), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("subject", sa.String(length=40), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("attachment_filename", sa.String(length=255), nullable=True),
        sa.Column("attachment_content_type", sa.String(length=127), nullable=True),
        sa.Column("attachment_size_bytes", sa.Integer(), nullable=True),
        sa.CheckConstraint(
            "(attachment_filename IS NULL AND attachment_content_type IS NULL"
            " AND attachment_size_bytes IS NULL)"
            " OR (attachment_filename IS NOT NULL AND attachment_content_type IS NOT NULL"
            " AND attachment_size_bytes IS NOT NULL AND attachment_size_bytes >= 0)",
            name=op.f("ck_messages_attachment_complete"),
        ),
        sa.CheckConstraint(
            "char_length(btrim(subject)) > 0", name=op.f("ck_messages_subject_not_blank")
        ),
        sa.CheckConstraint(
            "char_length(subject) <= 40", name=op.f("ck_messages_subject_max_length")
        ),
        sa.CheckConstraint("char_length(btrim(text)) > 0", name=op.f("ck_messages_text_not_blank")),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name=op.f("fk_messages_user_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_messages")),
    )
    # Serves "a user's messages, newest first"; also covers lookups by user_id alone.
    op.create_index(
        "ix_messages_user_id_created_at",
        "messages",
        ["user_id", sa.literal_column("created_at DESC")],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_messages_user_id_created_at", table_name="messages")
    op.drop_table("messages")
    op.drop_table("users")
