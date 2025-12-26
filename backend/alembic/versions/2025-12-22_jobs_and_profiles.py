"""Add jobs and user_profiles tables for job search pipeline.

Revision ID: 4a9bb3cd2345
Revises: 3f8aa2bc1234
Create Date: 2025-12-22 15:00:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4a9bb3cd2345"
down_revision: str | None = "3f8aa2bc1234"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create user_profiles table
    op.create_table(
        "user_profiles",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("resume_text", sa.Text(), nullable=True),
        sa.Column("target_roles", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("target_locations", postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column("min_score_threshold", sa.Float(), nullable=False, default=7.0),
        sa.Column("preferences", postgresql.JSON(astext_type=sa.Text()), nullable=True),
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
            name=op.f("user_profiles_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("user_profiles_pkey")),
        sa.UniqueConstraint("user_id", name=op.f("user_profiles_user_id_key")),
    )
    op.create_index(
        op.f("user_profiles_user_id_idx"),
        "user_profiles",
        ["user_id"],
        unique=True,
    )

    # Create jobs table
    op.create_table(
        "jobs",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=False),
        sa.Column("company", sa.String(length=255), nullable=False),
        sa.Column("location", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("job_url", sa.String(length=2048), nullable=False),
        sa.Column("salary_range", sa.String(length=100), nullable=True),
        sa.Column("date_posted", sa.DateTime(timezone=True), nullable=True),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("relevance_score", sa.Float(), nullable=True),
        sa.Column("reasoning", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=50), nullable=False, default="new"),
        sa.Column("search_terms", sa.String(length=500), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
            name=op.f("jobs_user_id_fkey"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("jobs_pkey")),
        sa.UniqueConstraint("user_id", "job_url", name="jobs_user_id_job_url_key"),
    )
    # Indexes for common queries
    op.create_index(
        op.f("jobs_user_id_idx"),
        "jobs",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("jobs_status_idx"),
        "jobs",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("jobs_relevance_score_idx"),
        "jobs",
        ["relevance_score"],
        unique=False,
    )
    op.create_index(
        op.f("jobs_created_at_idx"),
        "jobs",
        ["created_at"],
        unique=False,
    )


def downgrade() -> None:
    # Drop jobs table
    op.drop_index(op.f("jobs_created_at_idx"), table_name="jobs")
    op.drop_index(op.f("jobs_relevance_score_idx"), table_name="jobs")
    op.drop_index(op.f("jobs_status_idx"), table_name="jobs")
    op.drop_index(op.f("jobs_user_id_idx"), table_name="jobs")
    op.drop_table("jobs")

    # Drop user_profiles table
    op.drop_index(op.f("user_profiles_user_id_idx"), table_name="user_profiles")
    op.drop_table("user_profiles")
