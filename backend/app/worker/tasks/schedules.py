"""Taskiq scheduled tasks (cron-like)."""

import logging

from app.utils.billing_cycles import advance_billing_cycle
from app.worker.taskiq_app import broker
from app.worker.tasks.taskiq_examples import example_task

logger = logging.getLogger(__name__)

# Define scheduled tasks using labels
# These are picked up by the scheduler


@broker.task(schedule=[{"cron": "* * * * *"}])  # Every minute
async def scheduled_example() -> dict:
    """PLACEHOLDER EXAMPLE - Scheduled task that runs every minute.

    This is an example scheduled task demonstrating cron-based scheduling.
    Copy and modify this for your own scheduled tasks.

    This task is intentionally kept as a reference example and can be safely
    disabled or deleted if not needed.
    """
    result = await example_task.kiq("scheduled")
    return {"scheduled": True, "task_id": str(result.task_id)}


@broker.task(schedule=[{"cron": "0 * * * *"}])  # Every hour (at minute 0)
async def sync_all_email_sources() -> dict:
    """Sync job emails for all active email sources.

    This task runs every hour (matches EMAIL_SYNC_INTERVAL_MINUTES=60) and:
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


@broker.task(schedule=[{"cron": "0 0 * * *"}])  # Daily at midnight UTC
async def process_due_recurring_expenses() -> dict:
    """Auto-deduct due recurring expenses from their linked accounts.

    Runs daily at midnight. For each active recurring expense that:
    - Has an account_id set
    - Has an expected_amount set
    - Has next_due_date on or before today

    The task will:
    1. Create a debit transaction against the linked account
    2. Deduct the amount from the account's current_balance
    3. Advance next_due_date by one billing cycle
    4. Set last_seen_date = today
    """
    from datetime import UTC, date, datetime

    from app.db.models.finance import Transaction, TransactionSource, TransactionType
    from app.db.session import get_db_context
    from app.repositories import finance_repo

    today = date.today()
    results: dict = {"processed": 0, "skipped": 0, "errors": []}

    async with get_db_context() as db:
        due_expenses = await finance_repo.get_due_recurring_with_accounts(db, today)
        logger.info("Found %d due recurring expenses to process", len(due_expenses))

        for expense in due_expenses:
            try:
                # Create a debit transaction for the charge
                tx = Transaction(
                    user_id=expense.user_id,
                    account_id=expense.account_id,
                    recurring_expense_id=expense.id,
                    amount=-expense.expected_amount,  # type: ignore[operator]
                    description=expense.name,
                    merchant=expense.merchant or expense.name,
                    transaction_date=today,
                    transaction_type=TransactionType.DEBIT.value,
                    category=expense.category,
                    source=TransactionSource.MANUAL.value,
                    is_reviewed=True,
                )
                db.add(tx)

                # Deduct from account balance (if account exists and has a balance)
                account = await finance_repo.get_account_by_id(db, expense.account_id)  # type: ignore[arg-type]
                if account and account.current_balance is not None:
                    await finance_repo.update_account(
                        db,
                        account=account,
                        update_data={
                            "current_balance": account.current_balance - expense.expected_amount,
                            "balance_updated_at": datetime.now(UTC),
                        },
                    )

                # Advance next_due_date and mark last seen
                new_due = advance_billing_cycle(expense.next_due_date, expense.billing_cycle)  # type: ignore[arg-type]
                await finance_repo.update_recurring(
                    db,
                    recurring=expense,
                    update_data={
                        "next_due_date": new_due,
                        "last_seen_date": today,
                    },
                )

                await db.flush()
                results["processed"] += 1
                logger.info(
                    "Processed recurring expense '%s' (user=%s, amount=%s, next_due=%s)",
                    expense.name,
                    expense.user_id,
                    expense.expected_amount,
                    new_due,
                )

            except Exception as e:
                error_msg = f"{expense.name} (id={expense.id}): {e}"
                logger.exception("Error processing recurring expense %s", expense.id)
                results["errors"].append(error_msg)
                results["skipped"] += 1

        await db.commit()

    logger.info(
        "Recurring expense processing complete: %d processed, %d skipped",
        results["processed"],
        results["skipped"],
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
