"""job_profile_id_and_dismissed_status

Revision ID: dbbbacd89f4f
Revises: job_soft_delete
Create Date: 2025-12-28 10:23:49.193329

Adds profile_id FK to jobs table to track which profile was used during search.
Also renames ARCHIVED status to DISMISSED (handled in code, no DB change needed).
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "dbbbacd89f4f"
down_revision: Union[str, None] = "job_soft_delete"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add profile_id column to jobs table
    op.add_column("jobs", sa.Column("profile_id", sa.UUID(), nullable=True))
    op.create_index("jobs_profile_id_idx", "jobs", ["profile_id"], unique=False)
    op.create_foreign_key(
        "jobs_profile_id_fkey",
        "jobs",
        "job_profiles",
        ["profile_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # Update any existing 'archived' status to 'dismissed'
    op.execute("UPDATE jobs SET status = 'dismissed' WHERE status = 'archived'")


def downgrade() -> None:
    # Revert 'dismissed' back to 'archived'
    op.execute("UPDATE jobs SET status = 'archived' WHERE status = 'dismissed'")

    # Remove profile_id column
    op.drop_constraint("jobs_profile_id_fkey", "jobs", type_="foreignkey")
    op.drop_index("jobs_profile_id_idx", table_name="jobs")
    op.drop_column("jobs", "profile_id")
