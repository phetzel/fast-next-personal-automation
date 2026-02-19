"""
PLACEHOLDER EXAMPLE - Cleanup old or stale data from the database.

This command template is useful for maintenance tasks.
Add your own cleanup logic for specific models as needed.

This file is intentionally kept as a reference example and can be safely
modified or deleted if not needed.
"""

import asyncio
from datetime import UTC, datetime, timedelta

import click

from app.commands import command, info, success, warning


@command("cleanup", help="[EXAMPLE] Clean up old data from the database")
@click.option("--days", "-d", default=30, type=int, help="Delete records older than N days")
@click.option("--dry-run", is_flag=True, help="Show what would be deleted without making changes")
@click.option("--force", "-f", is_flag=True, help="Skip confirmation prompt")
def cleanup(days: int, dry_run: bool, force: bool) -> None:
    """
    PLACEHOLDER EXAMPLE - Remove old records from the database.

    This is a template cleanup command. Add your own cleanup logic
    for specific models (e.g., old pipeline runs, expired sessions, etc.)

    Example:
        project cmd cleanup --days 90
        project cmd cleanup --days 30 --dry-run
        project cmd cleanup --days 7 --force
    """
    cutoff_date = datetime.now(UTC) - timedelta(days=days)

    if dry_run:
        info(f"[DRY RUN] Would delete records older than {cutoff_date}")
        return

    if not force and not click.confirm(
        f"Delete all records older than {days} days ({cutoff_date})?"
    ):
        warning("Aborted.")
        return
    from app.db.session import async_session_maker

    async def _cleanup():
        async with async_session_maker() as _session:
            info(f"Cleaning up records older than {cutoff_date}...")

            # TODO: Add your cleanup logic here
            # Example for cleaning up old pipeline runs:
            # from sqlalchemy import delete
            # from app.db.models import PipelineRun
            # result = await session.execute(
            #     delete(PipelineRun).where(PipelineRun.created_at < cutoff_date)
            # )
            # await session.commit()
            # deleted_count = result.rowcount

            deleted_count = 0  # Replace with actual count
            success(f"Deleted {deleted_count} records.")

    asyncio.run(_cleanup())
