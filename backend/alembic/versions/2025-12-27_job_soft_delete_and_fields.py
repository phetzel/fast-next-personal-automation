"""Add soft delete and additional scrape fields to jobs.

Revision ID: job_soft_delete
Revises: profile_contact_info
Create Date: 2025-12-27

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "job_soft_delete"
down_revision: str | None = "profile_contact_info"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add soft delete column and additional scrape fields to jobs table."""
    # Soft delete column
    op.add_column(
        "jobs",
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
    )

    # Additional scrape fields from python-jobspy
    op.add_column(
        "jobs",
        sa.Column("is_remote", sa.Boolean(), nullable=True),
    )
    op.add_column(
        "jobs",
        sa.Column("job_type", sa.String(50), nullable=True),
    )
    op.add_column(
        "jobs",
        sa.Column("company_url", sa.String(2048), nullable=True),
    )


def downgrade() -> None:
    """Remove soft delete column and additional scrape fields from jobs table."""
    op.drop_column("jobs", "company_url")
    op.drop_column("jobs", "job_type")
    op.drop_column("jobs", "is_remote")
    op.drop_column("jobs", "deleted_at")

