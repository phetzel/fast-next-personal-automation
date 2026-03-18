"""Add richer job analysis metadata fields for analyze-before-prep workflow.

Revision ID: job_analysis_metadata_001
Revises: job_workflow_refactor_001
Create Date: 2026-03-18 11:30:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect

from alembic import op

revision: str = "job_analysis_metadata_001"
down_revision: str | None = "job_workflow_refactor_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("jobs")}

    if "cover_letter_requested" not in existing_columns:
        op.add_column("jobs", sa.Column("cover_letter_requested", sa.Boolean(), nullable=True))

    if "ats_family" not in existing_columns:
        op.add_column("jobs", sa.Column("ats_family", sa.String(length=100), nullable=True))

    if "analysis_source" not in existing_columns:
        op.add_column("jobs", sa.Column("analysis_source", sa.String(length=50), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("jobs")}

    if "analysis_source" in existing_columns:
        op.drop_column("jobs", "analysis_source")

    if "ats_family" in existing_columns:
        op.drop_column("jobs", "ats_family")

    if "cover_letter_requested" in existing_columns:
        op.drop_column("jobs", "cover_letter_requested")
