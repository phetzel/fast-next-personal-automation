"""add story and projects to job profiles

Revision ID: 1b6jj0kl0123
Revises: 0a5ii9jk9012
Create Date: 2025-12-24

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1b6jj0kl0123"
down_revision: str | None = "0a5ii9jk9012"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add story_id foreign key to job_profiles
    op.add_column(
        "job_profiles",
        sa.Column(
            "story_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("stories.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_job_profiles_story_id", "job_profiles", ["story_id"])

    # Add project_ids JSON array to job_profiles
    op.add_column(
        "job_profiles",
        sa.Column(
            "project_ids",
            postgresql.JSON,
            nullable=True,
            server_default="[]",
        ),
    )

    # Remove is_active from projects table (no longer needed - projects are linked via profile)
    op.drop_column("projects", "is_active")


def downgrade() -> None:
    # Add is_active back to projects
    op.add_column(
        "projects",
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default="true",
        ),
    )

    # Remove project_ids from job_profiles
    op.drop_column("job_profiles", "project_ids")

    # Remove story_id from job_profiles
    op.drop_index("ix_job_profiles_story_id", table_name="job_profiles")
    op.drop_column("job_profiles", "story_id")
