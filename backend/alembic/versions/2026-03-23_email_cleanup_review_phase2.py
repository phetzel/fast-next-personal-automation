"""email cleanup review phase 2

Revision ID: email_cleanup_review_001
Revises: email_triage_phase1_001
Create Date: 2026-03-23 19:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_cleanup_review_001"
down_revision: str | None = "email_triage_phase1_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_messages",
        sa.Column("archive_recommended", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_email_messages_archive_recommended"),
        "email_messages",
        ["archive_recommended"],
        unique=False,
    )
    op.alter_column("email_messages", "archive_recommended", server_default=None)

    op.add_column(
        "email_destinations",
        sa.Column("always_keep", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "email_destinations",
        sa.Column("queue_unsubscribe", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "email_destinations",
        sa.Column("suggest_archive", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "email_destinations",
        sa.Column("bucket_override", sa.String(length=50), nullable=True),
    )
    op.alter_column("email_destinations", "always_keep", server_default=None)
    op.alter_column("email_destinations", "queue_unsubscribe", server_default=None)
    op.alter_column("email_destinations", "suggest_archive", server_default=None)

    op.create_table(
        "email_action_logs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.UUID(), nullable=True),
        sa.Column("gmail_thread_id", sa.String(length=255), nullable=True),
        sa.Column("normalized_sender", sa.String(length=255), nullable=True),
        sa.Column("sender_domain", sa.String(length=255), nullable=True),
        sa.Column("action_type", sa.String(length=50), nullable=False),
        sa.Column("action_status", sa.String(length=20), nullable=False),
        sa.Column("action_source", sa.String(length=20), nullable=False),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("action_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["email_messages.id"],
            name="email_action_logs_message_id_fkey",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="email_action_logs_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="email_action_logs_pkey"),
    )
    op.create_index("email_action_logs_user_id_idx", "email_action_logs", ["user_id"], unique=False)
    op.create_index(
        "email_action_logs_message_id_idx", "email_action_logs", ["message_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("email_action_logs_message_id_idx", table_name="email_action_logs")
    op.drop_index("email_action_logs_user_id_idx", table_name="email_action_logs")
    op.drop_table("email_action_logs")

    op.drop_column("email_destinations", "bucket_override")
    op.drop_column("email_destinations", "suggest_archive")
    op.drop_column("email_destinations", "queue_unsubscribe")
    op.drop_column("email_destinations", "always_keep")

    op.drop_index(
        op.f("ix_email_messages_archive_recommended"),
        table_name="email_messages",
    )
    op.drop_column("email_messages", "archive_recommended")
