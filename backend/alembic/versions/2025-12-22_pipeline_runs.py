"""Add pipeline_runs table for execution history tracking.

Revision ID: 3f8aa2bc1234
Revises: 2d5dd1fe1265
Create Date: 2025-12-22 10:00:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f8aa2bc1234"
down_revision: str | None = "2d5dd1fe1265"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "pipeline_runs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("pipeline_name", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("trigger_type", sa.String(length=20), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=True),
        sa.Column("input_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("output_data", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("run_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
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
            name=op.f("pipeline_runs_user_id_fkey"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pipeline_runs_pkey")),
    )
    # Indexes for common queries
    op.create_index(
        op.f("pipeline_runs_pipeline_name_idx"),
        "pipeline_runs",
        ["pipeline_name"],
        unique=False,
    )
    op.create_index(
        op.f("pipeline_runs_status_idx"),
        "pipeline_runs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("pipeline_runs_trigger_type_idx"),
        "pipeline_runs",
        ["trigger_type"],
        unique=False,
    )
    op.create_index(
        op.f("pipeline_runs_created_at_idx"),
        "pipeline_runs",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("pipeline_runs_user_id_idx"),
        "pipeline_runs",
        ["user_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("pipeline_runs_user_id_idx"), table_name="pipeline_runs")
    op.drop_index(op.f("pipeline_runs_created_at_idx"), table_name="pipeline_runs")
    op.drop_index(op.f("pipeline_runs_trigger_type_idx"), table_name="pipeline_runs")
    op.drop_index(op.f("pipeline_runs_status_idx"), table_name="pipeline_runs")
    op.drop_index(op.f("pipeline_runs_pipeline_name_idx"), table_name="pipeline_runs")
    op.drop_table("pipeline_runs")

