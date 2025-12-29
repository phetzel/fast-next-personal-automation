"""Email sync pipeline for parsing job emails."""

from app.pipelines.actions.email_sync.pipeline import EmailSyncJobsPipeline

__all__ = ["EmailSyncJobsPipeline"]

