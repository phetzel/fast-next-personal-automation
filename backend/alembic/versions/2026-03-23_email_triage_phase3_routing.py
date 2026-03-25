"""email triage phase 3 routing

Add source_email_message_id FK to jobs and finance_transactions tables
for cross-area traceability from triage routing.

Revision ID: email_triage_phase3_001
Revises: email_cleanup_review_001
Create Date: 2026-03-23 20:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "email_triage_phase3_001"
down_revision: str | None = "email_cleanup_review_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add source_email_message_id to jobs
    op.add_column(
        "jobs",
        sa.Column(
            "source_email_message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("email_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_jobs_source_email_message_id",
        "jobs",
        ["source_email_message_id"],
    )

    # Add source_email_message_id to finance_transactions
    op.add_column(
        "finance_transactions",
        sa.Column(
            "source_email_message_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("email_messages.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index(
        "ix_finance_transactions_source_email_message_id",
        "finance_transactions",
        ["source_email_message_id"],
    )

    # Best-effort backfill: jobs from email_message_destinations.created_item_ids
    op.execute("""
        UPDATE jobs
        SET source_email_message_id = emd.message_id
        FROM email_message_destinations emd
        WHERE emd.created_item_ids IS NOT NULL
          AND emd.created_item_ids::text != '[]'
          AND jobs.id::text IN (
              SELECT jsonb_array_elements_text(emd.created_item_ids::jsonb)
          )
          AND jobs.source_email_message_id IS NULL
    """)

    # Best-effort backfill: finance_transactions from raw_email_id matching
    op.execute("""
        UPDATE finance_transactions ft
        SET source_email_message_id = em.id
        FROM email_messages em
        JOIN email_sources es ON em.source_id = es.id
        WHERE ft.raw_email_id IS NOT NULL
          AND ft.raw_email_id = em.gmail_message_id
          AND es.user_id = ft.user_id
          AND ft.source_email_message_id IS NULL
    """)


def downgrade() -> None:
    op.drop_index(
        "ix_finance_transactions_source_email_message_id",
        table_name="finance_transactions",
    )
    op.drop_column("finance_transactions", "source_email_message_id")
    op.drop_index("ix_jobs_source_email_message_id", table_name="jobs")
    op.drop_column("jobs", "source_email_message_id")
