"""Add contact info fields to job_profiles.

Revision ID: profile_contact_info
Revises: cover_letter_pdf
Create Date: 2025-12-26

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "profile_contact_info"
down_revision: str | None = "cover_letter_pdf"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add contact info columns to job_profiles table."""
    op.add_column(
        "job_profiles",
        sa.Column("contact_full_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_profiles",
        sa.Column("contact_phone", sa.String(50), nullable=True),
    )
    op.add_column(
        "job_profiles",
        sa.Column("contact_email", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_profiles",
        sa.Column("contact_location", sa.String(255), nullable=True),
    )
    op.add_column(
        "job_profiles",
        sa.Column("contact_website", sa.String(255), nullable=True),
    )


def downgrade() -> None:
    """Remove contact info columns from job_profiles table."""
    op.drop_column("job_profiles", "contact_website")
    op.drop_column("job_profiles", "contact_location")
    op.drop_column("job_profiles", "contact_email")
    op.drop_column("job_profiles", "contact_phone")
    op.drop_column("job_profiles", "contact_full_name")

