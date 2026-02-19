"""Drop obsolete job_apply tracking columns.

Revision ID: drop_job_apply_tracking_001
Revises: scheduled_tasks_001
Create Date: 2026-01-06 12:00:00.000000

Removes job_apply-specific tracking fields that are no longer used.
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "drop_job_apply_tracking_001"
down_revision: str | None = "scheduled_tasks_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_column("jobs", "confirmation_code")
    op.drop_column("jobs", "application_method")
    op.drop_column("jobs", "applied_at")


def downgrade() -> None:
    op.add_column("jobs", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("application_method", sa.String(50), nullable=True))
    op.add_column("jobs", sa.Column("confirmation_code", sa.String(255), nullable=True))
