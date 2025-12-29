"""Taskiq scheduled tasks (cron-like)."""

import logging

from app.worker.taskiq_app import broker
from app.worker.tasks.taskiq_examples import example_task

logger = logging.getLogger(__name__)

# Define scheduled tasks using labels
# These are picked up by the scheduler


@broker.task(schedule=[{"cron": "* * * * *"}])  # Every minute
async def scheduled_example() -> dict:
    """Example scheduled task that runs every minute."""
    result = await example_task.kiq("scheduled")
    return {"scheduled": True, "task_id": str(result.task_id)}


@broker.task(schedule=[{"cron": "*/15 * * * *"}])  # Every 15 minutes
async def sync_all_email_sources() -> dict:
    """Sync job emails for all active email sources.

    This task runs every 15 minutes and:
    1. Fetches all active EmailSource records
    2. For each source, runs the email_sync_jobs pipeline
    3. Logs results and any errors

    Returns:
        Dict with sync results summary
    """
    from app.db.session import get_db_context
    from app.pipelines.action_base import PipelineContext
    from app.pipelines.registry import execute_pipeline
    from app.repositories import email_source_repo

    logger.info("Starting scheduled email sync for all sources")

    results = {
        "sources_processed": 0,
        "total_emails_processed": 0,
        "total_jobs_saved": 0,
        "errors": [],
    }

    async with get_db_context() as db:
        sources = await email_source_repo.get_all_active(db)
        logger.info(f"Found {len(sources)} active email sources")

        for source in sources:
            try:
                context = PipelineContext(
                    user_id=source.user_id,
                    source="scheduler",
                )

                result = await execute_pipeline(
                    "email_sync_jobs",
                    {"source_id": str(source.id)},
                    context,
                    db=db,
                )

                results["sources_processed"] += 1
                if result.success and result.output:
                    results["total_emails_processed"] += result.output.emails_processed
                    results["total_jobs_saved"] += result.output.jobs_saved
                elif not result.success:
                    results["errors"].append(f"{source.email_address}: {result.error}")

            except Exception as e:
                error_msg = f"{source.email_address}: {e}"
                logger.exception(f"Error syncing {source.email_address}")
                results["errors"].append(error_msg)

        await db.commit()

    logger.info(
        f"Email sync complete: {results['sources_processed']} sources, "
        f"{results['total_emails_processed']} emails, "
        f"{results['total_jobs_saved']} jobs saved"
    )

    return results


# Alternative: Define schedules in scheduler source
# The scheduler will read these when started with --source flag
SCHEDULES = [
    {
        "task": "app.worker.tasks.taskiq_examples:example_task",
        "cron": "*/5 * * * *",  # Every 5 minutes
        "args": ["periodic-5min"],
    },
]
