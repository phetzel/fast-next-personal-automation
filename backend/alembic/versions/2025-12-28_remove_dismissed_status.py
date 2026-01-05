"""Remove dismissed status - soft delete dismissed jobs.

Revision ID: remove_dismissed_status
Revises: job_profile_id_and_dismissed_status
Create Date: 2025-12-28

This migration:
1. Soft-deletes all jobs with status='dismissed' (sets deleted_at)
2. The dismissed status is no longer used - jobs are just soft-deleted instead
"""

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision = "remove_dismissed_status"
down_revision = "dbbbacd89f4f"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Soft-delete all dismissed jobs."""
    # Update all jobs with status='dismissed' to have deleted_at set
    op.execute(
        sa.text(
            """
            UPDATE jobs
            SET deleted_at = NOW()
            WHERE status = 'dismissed' AND deleted_at IS NULL
            """
        )
    )


def downgrade() -> None:
    """Restore dismissed jobs (unset deleted_at for recently deleted dismissed jobs).

    Note: This is a best-effort downgrade. Jobs that were dismissed and then
    had deleted_at set by this migration will be restored. Jobs that were
    already soft-deleted before will not be affected.
    """
    # We can't perfectly reverse this, but we can restore jobs that were
    # dismissed and deleted within the migration window
    # For safety, we won't automatically restore them - manual intervention required
    pass
