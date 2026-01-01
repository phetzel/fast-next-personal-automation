"""Gmail API client wrapper.

Provides a class-based Gmail client for reading and parsing job alert emails.
"""

import asyncio
import base64
import logging
from dataclasses import dataclass
from datetime import UTC, datetime
from email.utils import parsedate_to_datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from app.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EmailContent:
    """Parsed email content."""

    message_id: str
    thread_id: str
    subject: str
    from_address: str
    received_at: datetime
    body_html: str
    body_text: str
    snippet: str


class GmailClient:
    """Gmail API client wrapper for reading job alert emails.

    Handles OAuth token refresh and provides methods for searching and
    reading emails from specific senders.
    """

    def __init__(
        self,
        access_token: str,
        refresh_token: str,
        token_expiry: datetime | None = None,
    ):
        """Initialize Gmail client with OAuth credentials.

        Args:
            access_token: OAuth access token for Gmail API.
            refresh_token: OAuth refresh token for token renewal.
            token_expiry: When the access token expires.
        """
        # Google's Credentials class expects timezone-naive datetime for expiry
        # (it compares against datetime.utcnow() internally)
        expiry_naive = None
        if token_expiry is not None:
            if token_expiry.tzinfo is not None:
                # Convert to UTC and strip timezone
                expiry_naive = token_expiry.replace(tzinfo=None)
            else:
                expiry_naive = token_expiry

        self.credentials = Credentials(
            token=access_token,
            refresh_token=refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            expiry=expiry_naive,
        )
        self._service = None
        self._tokens_refreshed = False

    @property
    def service(self):
        """Get or create the Gmail API service."""
        if self._service is None:
            # Refresh token if expired
            if self.credentials.expired and self.credentials.refresh_token:
                logger.info("Refreshing expired Gmail access token")
                self.credentials.refresh(Request())
                self._tokens_refreshed = True

            self._service = build("gmail", "v1", credentials=self.credentials)
        return self._service

    @property
    def tokens_refreshed(self) -> bool:
        """Check if tokens were refreshed during this session."""
        return self._tokens_refreshed

    @property
    def new_access_token(self) -> str | None:
        """Get the new access token if it was refreshed."""
        if self._tokens_refreshed:
            return self.credentials.token
        return None

    @property
    def new_token_expiry(self) -> datetime | None:
        """Get the new token expiry if it was refreshed."""
        if self._tokens_refreshed:
            return self.credentials.expiry
        return None

    def build_sender_query(
        self,
        senders: list[str],
        after_timestamp: datetime | None = None,
        unread_only: bool = False,
    ) -> str:
        """Build a Gmail search query for specific senders.

        Args:
            senders: List of sender email addresses or domains.
            after_timestamp: Only get messages after this time.
            unread_only: Only get unread messages.

        Returns:
            Gmail search query string.

        Example:
            >>> client.build_sender_query(["indeed.com", "linkedin.com"])
            '(from:indeed.com OR from:linkedin.com)'
        """
        if not senders:
            return ""

        # Build sender part of query
        sender_parts = [f"from:{sender}" for sender in senders]
        query = f"({' OR '.join(sender_parts)})"

        # Add date filter
        if after_timestamp:
            # Gmail uses YYYY/MM/DD format
            date_str = after_timestamp.strftime("%Y/%m/%d")
            query += f" after:{date_str}"

        # Add unread filter
        if unread_only:
            query += " is:unread"

        return query

    def _list_messages_sync(self, query: str, max_results: int) -> list[dict]:
        """Synchronous implementation of list_messages."""
        messages = []
        request = (
            self.service.users()
            .messages()
            .list(userId="me", q=query, maxResults=min(max_results, 100))
        )

        while request is not None and len(messages) < max_results:
            response = request.execute()
            batch = response.get("messages", [])
            messages.extend(batch)

            # Check for more pages
            if "nextPageToken" in response and len(messages) < max_results:
                request = (
                    self.service.users()
                    .messages()
                    .list(
                        userId="me",
                        q=query,
                        maxResults=min(max_results - len(messages), 100),
                        pageToken=response["nextPageToken"],
                    )
                )
            else:
                break

        return messages[:max_results]

    async def list_messages(
        self,
        query: str,
        max_results: int = 100,
    ) -> list[dict]:
        """List messages matching a query.

        Args:
            query: Gmail search query (e.g., 'from:indeed.com').
            max_results: Maximum number of messages to return.

        Returns:
            List of message metadata dicts with 'id' and 'threadId'.
        """
        try:
            return await asyncio.to_thread(self._list_messages_sync, query, max_results)
        except HttpError as e:
            logger.error(f"Gmail API error listing messages: {e}")
            raise

    def _get_message_sync(self, message_id: str) -> EmailContent:
        """Synchronous implementation of get_message."""
        message = (
            self.service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )

        # Extract headers
        headers = {h["name"].lower(): h["value"] for h in message["payload"]["headers"]}

        subject = headers.get("subject", "(No Subject)")
        from_address = headers.get("from", "")
        date_str = headers.get("date", "")

        # Parse date
        try:
            received_at = parsedate_to_datetime(date_str)
        except (ValueError, TypeError):
            received_at = datetime.now(UTC)

        # Extract body
        body_html, body_text = self._extract_body(message["payload"])

        return EmailContent(
            message_id=message["id"],
            thread_id=message["threadId"],
            subject=subject,
            from_address=from_address,
            received_at=received_at,
            body_html=body_html,
            body_text=body_text,
            snippet=message.get("snippet", ""),
        )

    async def get_message(self, message_id: str) -> EmailContent:
        """Get full message content.

        Args:
            message_id: Gmail message ID.

        Returns:
            EmailContent with parsed message data.
        """
        try:
            return await asyncio.to_thread(self._get_message_sync, message_id)
        except HttpError as e:
            logger.error(f"Gmail API error getting message {message_id}: {e}")
            raise

    def _extract_body(self, payload: dict) -> tuple[str, str]:
        """Extract HTML and plain text body from message payload.

        Args:
            payload: Gmail message payload.

        Returns:
            Tuple of (html_body, text_body).
        """
        html_body = ""
        text_body = ""

        def process_part(part: dict) -> None:
            nonlocal html_body, text_body

            mime_type = part.get("mimeType", "")
            body = part.get("body", {})
            data = body.get("data", "")

            if data:
                decoded = base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")
                if mime_type == "text/html":
                    html_body = decoded
                elif mime_type == "text/plain":
                    text_body = decoded

            # Process nested parts
            for sub_part in part.get("parts", []):
                process_part(sub_part)

        process_part(payload)

        return html_body, text_body

    def _mark_as_read_sync(self, message_id: str) -> None:
        """Synchronous implementation of mark_as_read."""
        self.service.users().messages().modify(
            userId="me",
            id=message_id,
            body={"removeLabelIds": ["UNREAD"]},
        ).execute()

    async def mark_as_read(self, message_id: str) -> None:
        """Mark a message as read by removing UNREAD label.

        Args:
            message_id: Gmail message ID.
        """
        try:
            await asyncio.to_thread(self._mark_as_read_sync, message_id)
        except HttpError as e:
            logger.error(f"Gmail API error marking message {message_id} as read: {e}")
            raise

    def _get_profile_sync(self) -> dict:
        """Synchronous implementation of get_profile."""
        return self.service.users().getProfile(userId="me").execute()

    async def get_profile(self) -> dict:
        """Get the authenticated user's Gmail profile.

        Returns:
            Dict with email address and other profile info.
        """
        try:
            return await asyncio.to_thread(self._get_profile_sync)
        except HttpError as e:
            logger.error(f"Gmail API error getting profile: {e}")
            raise
