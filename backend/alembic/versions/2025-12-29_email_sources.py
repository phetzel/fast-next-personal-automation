"""email_sources

Revision ID: email_sources_001
Revises: dbbbacd89f4f
Create Date: 2025-12-29 12:00:00.000000

Adds email_sources and email_messages tables for Gmail integration.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_sources_001"
down_revision: str | None = "remove_dismissed_status"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create email_sources table
    op.create_table(
        "email_sources",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("email_address", sa.String(255), nullable=False),
        sa.Column("provider", sa.String(50), nullable=False, server_default="gmail"),
        sa.Column("access_token", sa.Text(), nullable=False),
        sa.Column("refresh_token", sa.Text(), nullable=False),
        sa.Column("token_expiry", sa.DateTime(timezone=True), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("last_sync_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_error", sa.Text(), nullable=True),
        sa.Column("custom_senders", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="email_sources_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="email_sources_pkey"),
    )
    op.create_index("email_sources_user_id_idx", "email_sources", ["user_id"], unique=False)

    # Create email_messages table
    op.create_table(
        "email_messages",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("source_id", sa.UUID(), nullable=False),
        sa.Column("gmail_message_id", sa.String(255), nullable=False),
        sa.Column("gmail_thread_id", sa.String(255), nullable=True),
        sa.Column("subject", sa.String(1000), nullable=False),
        sa.Column("from_address", sa.String(255), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("jobs_extracted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("parser_used", sa.String(50), nullable=True),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["source_id"],
            ["email_sources.id"],
            name="email_messages_source_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="email_messages_pkey"),
    )
    op.create_index("email_messages_source_id_idx", "email_messages", ["source_id"], unique=False)
    op.create_index(
        "email_messages_gmail_message_id_idx", "email_messages", ["gmail_message_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("email_messages_gmail_message_id_idx", table_name="email_messages")
    op.drop_index("email_messages_source_id_idx", table_name="email_messages")
    op.drop_table("email_messages")
    op.drop_index("email_sources_user_id_idx", table_name="email_sources")
    op.drop_table("email_sources")
