"""Add job workflow persistence fields for analyzed/apply stages.

Revision ID: job_workflow_refactor_001
Revises: finance_account_default_001
Create Date: 2026-03-12 12:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy import inspect
from sqlalchemy.dialects.postgresql import JSON

from alembic import op

revision: str = "job_workflow_refactor_001"
down_revision: str | None = "finance_account_default_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("jobs")}

    if "screening_answers" not in existing_columns:
        op.add_column("jobs", sa.Column("screening_answers", JSON(), nullable=True))

    if "applied_at" not in existing_columns:
        op.add_column("jobs", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))

    if "application_method" not in existing_columns:
        op.add_column("jobs", sa.Column("application_method", sa.String(50), nullable=True))

    if "confirmation_code" not in existing_columns:
        op.add_column("jobs", sa.Column("confirmation_code", sa.String(255), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    inspector = inspect(bind)
    existing_columns = {column["name"] for column in inspector.get_columns("jobs")}

    if "confirmation_code" in existing_columns:
        op.drop_column("jobs", "confirmation_code")

    if "application_method" in existing_columns:
        op.drop_column("jobs", "application_method")

    if "applied_at" in existing_columns:
        op.drop_column("jobs", "applied_at")

    if "screening_answers" in existing_columns:
        op.drop_column("jobs", "screening_answers")
