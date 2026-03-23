"""email triage phase 1

Revision ID: email_triage_phase1_001
Revises: email_sync_hardening_001
Create Date: 2026-03-23 17:30:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_triage_phase1_001"
down_revision: str | None = "email_sync_hardening_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "email_sources", sa.Column("last_triage_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column("email_sources", sa.Column("last_triage_error", sa.Text(), nullable=True))

    op.add_column("email_messages", sa.Column("bucket", sa.String(length=50), nullable=True))
    op.add_column(
        "email_messages",
        sa.Column("triage_status", sa.String(length=20), nullable=False, server_default="pending"),
    )
    op.add_column("email_messages", sa.Column("triage_confidence", sa.Float(), nullable=True))
    op.add_column("email_messages", sa.Column("actionability_score", sa.Float(), nullable=True))
    op.add_column("email_messages", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column(
        "email_messages",
        sa.Column("requires_review", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "email_messages",
        sa.Column("unsubscribe_candidate", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "email_messages",
        sa.Column("is_vip", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "email_messages", sa.Column("triaged_at", sa.DateTime(timezone=True), nullable=True)
    )
    op.add_column(
        "email_messages",
        sa.Column("last_action_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f("ix_email_messages_bucket"), "email_messages", ["bucket"], unique=False)

    op.alter_column("email_messages", "triage_status", server_default=None)
    op.alter_column("email_messages", "requires_review", server_default=None)
    op.alter_column("email_messages", "unsubscribe_candidate", server_default=None)
    op.alter_column("email_messages", "is_vip", server_default=None)


def downgrade() -> None:
    op.drop_index(op.f("ix_email_messages_bucket"), table_name="email_messages")
    op.drop_column("email_messages", "last_action_at")
    op.drop_column("email_messages", "triaged_at")
    op.drop_column("email_messages", "is_vip")
    op.drop_column("email_messages", "unsubscribe_candidate")
    op.drop_column("email_messages", "requires_review")
    op.drop_column("email_messages", "summary")
    op.drop_column("email_messages", "actionability_score")
    op.drop_column("email_messages", "triage_confidence")
    op.drop_column("email_messages", "triage_status")
    op.drop_column("email_messages", "bucket")
    op.drop_column("email_sources", "last_triage_error")
    op.drop_column("email_sources", "last_triage_at")
