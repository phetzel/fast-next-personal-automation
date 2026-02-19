"""Add scheduled_tasks table for calendar-based pipeline scheduling

Revision ID: scheduled_tasks_001
Revises: email_hub_001
Create Date: 2026-01-05 12:00:00.000000

Adds scheduled_tasks table for storing dynamic cron-based pipeline schedules
that can be managed via the frontend calendar interface.
"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "scheduled_tasks_001"
down_revision: str | None = "email_hub_001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create scheduled_tasks table
    op.create_table(
        "scheduled_tasks",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("pipeline_name", sa.String(100), nullable=False),
        sa.Column("cron_expression", sa.String(100), nullable=False),
        sa.Column("timezone", sa.String(50), nullable=False, server_default="UTC"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("input_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            name="scheduled_tasks_user_id_fkey",
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name="scheduled_tasks_pkey"),
    )
    op.create_index("scheduled_tasks_user_id_idx", "scheduled_tasks", ["user_id"], unique=False)
    op.create_index(
        "scheduled_tasks_pipeline_name_idx", "scheduled_tasks", ["pipeline_name"], unique=False
    )
    op.create_index("scheduled_tasks_enabled_idx", "scheduled_tasks", ["enabled"], unique=False)
    op.create_index(
        "scheduled_tasks_next_run_at_idx", "scheduled_tasks", ["next_run_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("scheduled_tasks_next_run_at_idx", table_name="scheduled_tasks")
    op.drop_index("scheduled_tasks_enabled_idx", table_name="scheduled_tasks")
    op.drop_index("scheduled_tasks_pipeline_name_idx", table_name="scheduled_tasks")
    op.drop_index("scheduled_tasks_user_id_idx", table_name="scheduled_tasks")
    op.drop_table("scheduled_tasks")
