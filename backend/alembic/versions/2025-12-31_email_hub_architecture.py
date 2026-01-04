"""Email hub architecture - syncs, destinations, routing

Revision ID: email_hub_001
Revises: 5763f1bd1846
Create Date: 2025-12-31 14:00:00.000000

Adds email_syncs, email_destinations, and email_message_destinations tables.
Updates email_messages with sync_id and to_address fields.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_hub_001"
down_revision: str | None = "5763f1bd1846"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create email_syncs table
    op.create_table(
        "email_syncs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("sources_synced", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("emails_fetched", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("emails_processed", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("sync_metadata", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="email_syncs_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="email_syncs_pkey"),
    )
    op.create_index("email_syncs_user_id_idx", "email_syncs", ["user_id"], unique=False)
    op.create_index("email_syncs_status_idx", "email_syncs", ["status"], unique=False)

    # Create email_destinations table
    op.create_table(
        "email_destinations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("destination_type", sa.String(50), nullable=False, server_default="jobs"),
        sa.Column("filter_rules", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("parser_name", sa.String(50), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("priority", sa.Integer(), nullable=False, server_default="0"),
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
            name="email_destinations_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="email_destinations_pkey"),
    )
    op.create_index(
        "email_destinations_user_id_idx", "email_destinations", ["user_id"], unique=False
    )

    # Create email_message_destinations junction table
    op.create_table(
        "email_message_destinations",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("message_id", sa.UUID(), nullable=False),
        sa.Column("destination_id", sa.UUID(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("parser_used", sa.String(50), nullable=True),
        sa.Column("items_extracted", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("processing_error", sa.Text(), nullable=True),
        sa.Column("created_item_ids", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["email_messages.id"],
            name="email_message_destinations_message_id_fkey",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["destination_id"],
            ["email_destinations.id"],
            name="email_message_destinations_destination_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="email_message_destinations_pkey"),
    )
    op.create_index(
        "email_message_destinations_message_id_idx",
        "email_message_destinations",
        ["message_id"],
        unique=False,
    )
    op.create_index(
        "email_message_destinations_destination_id_idx",
        "email_message_destinations",
        ["destination_id"],
        unique=False,
    )

    # Update email_messages table: add sync_id and to_address
    op.add_column("email_messages", sa.Column("sync_id", sa.UUID(), nullable=True))
    op.add_column("email_messages", sa.Column("to_address", sa.String(255), nullable=True))
    op.create_foreign_key(
        "email_messages_sync_id_fkey",
        "email_messages",
        "email_syncs",
        ["sync_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("email_messages_sync_id_idx", "email_messages", ["sync_id"], unique=False)

    # Make subject nullable (was NOT NULL before)
    op.alter_column("email_messages", "subject", existing_type=sa.String(1000), nullable=True)

    # Make received_at nullable (was NOT NULL before)
    op.alter_column(
        "email_messages", "received_at", existing_type=sa.DateTime(timezone=True), nullable=True
    )

    # Make processed_at nullable (was NOT NULL before)
    op.alter_column(
        "email_messages", "processed_at", existing_type=sa.DateTime(timezone=True), nullable=True
    )


def downgrade() -> None:
    # Revert email_messages changes
    op.alter_column(
        "email_messages", "processed_at", existing_type=sa.DateTime(timezone=True), nullable=False
    )
    op.alter_column(
        "email_messages", "received_at", existing_type=sa.DateTime(timezone=True), nullable=False
    )
    op.alter_column("email_messages", "subject", existing_type=sa.String(1000), nullable=False)
    op.drop_index("email_messages_sync_id_idx", table_name="email_messages")
    op.drop_constraint("email_messages_sync_id_fkey", "email_messages", type_="foreignkey")
    op.drop_column("email_messages", "to_address")
    op.drop_column("email_messages", "sync_id")

    # Drop email_message_destinations
    op.drop_index(
        "email_message_destinations_destination_id_idx", table_name="email_message_destinations"
    )
    op.drop_index(
        "email_message_destinations_message_id_idx", table_name="email_message_destinations"
    )
    op.drop_table("email_message_destinations")

    # Drop email_destinations
    op.drop_index("email_destinations_user_id_idx", table_name="email_destinations")
    op.drop_table("email_destinations")

    # Drop email_syncs
    op.drop_index("email_syncs_status_idx", table_name="email_syncs")
    op.drop_index("email_syncs_user_id_idx", table_name="email_syncs")
    op.drop_table("email_syncs")
