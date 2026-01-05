"""Add ingestion_source to jobs table

Revision ID: 5763f1bd1846
Revises: f97536b40747
Create Date: 2025-12-31 10:03:25.149290

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "5763f1bd1846"
down_revision: str | None = "f97536b40747"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add ingestion_source column to track how jobs were discovered (scrape, email, manual)
    op.add_column("jobs", sa.Column("ingestion_source", sa.String(length=20), nullable=True))
    op.create_index("ix_jobs_ingestion_source", "jobs", ["ingestion_source"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_jobs_ingestion_source", table_name="jobs")
    op.drop_column("jobs", "ingestion_source")
