"""job application and analysis fields

Revision ID: af5ii9jk9012
Revises: 0a5ii9jk9012
Create Date: 2025-12-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "af5ii9jk9012"
down_revision: str | None = "1b6jj0kl0123"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Application analysis columns (from job_analyze pipeline)
    op.add_column("jobs", sa.Column("application_type", sa.String(50), nullable=True))
    op.add_column("jobs", sa.Column("application_url", sa.String(2048), nullable=True))
    op.add_column("jobs", sa.Column("requires_cover_letter", sa.Boolean(), nullable=True))
    op.add_column("jobs", sa.Column("requires_resume", sa.Boolean(), nullable=True))
    op.add_column("jobs", sa.Column("detected_fields", JSON(), nullable=True))
    op.add_column("jobs", sa.Column("screening_questions", JSON(), nullable=True))
    op.add_column("jobs", sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True))

    # Application tracking columns (from job_apply pipeline)
    op.add_column("jobs", sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("jobs", sa.Column("application_method", sa.String(50), nullable=True))
    op.add_column("jobs", sa.Column("confirmation_code", sa.String(255), nullable=True))


def downgrade() -> None:
    # Drop application tracking columns
    op.drop_column("jobs", "confirmation_code")
    op.drop_column("jobs", "application_method")
    op.drop_column("jobs", "applied_at")

    # Drop application analysis columns
    op.drop_column("jobs", "analyzed_at")
    op.drop_column("jobs", "screening_questions")
    op.drop_column("jobs", "detected_fields")
    op.drop_column("jobs", "requires_resume")
    op.drop_column("jobs", "requires_cover_letter")
    op.drop_column("jobs", "application_url")
    op.drop_column("jobs", "application_type")
