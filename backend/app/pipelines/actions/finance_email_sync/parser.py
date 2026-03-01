"""OpenAI-based parser for financial transaction emails.

Extracts transaction data (merchant, amount, date, type) from raw email content.
Returns None if the email does not appear to be a transaction notification.
"""

import json
import logging
from datetime import date

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are a financial email parser. Extract transaction data from bank and financial emails.

Return a JSON object with:
{
  "is_transaction": true/false,
  "transactions": [
    {
      "merchant": "string (merchant or payee name, or null)",
      "amount": number (positive for credits/deposits, negative for debits/charges),
      "date": "YYYY-MM-DD (transaction date, or today if not found)",
      "description": "string (brief description)",
      "transaction_type": "debit" or "credit" or "transfer"
    }
  ]
}

Rules:
- is_transaction: true only for bank alerts, billing receipts, subscription charges, payment confirmations
- is_transaction: false for marketing, newsletters, job alerts, general notifications
- Charges/purchases/debits should be negative amounts
- Deposits/credits/refunds should be positive amounts
- For subscription renewals, the amount is negative (it's a charge)
- Extract ALL transactions if there are multiple in one email
- Use today's date in YYYY-MM-DD format if no date is found
"""


async def parse_transaction_email(
    subject: str,
    body_text: str,
    body_html: str,
    openai_api_key: str,
    today: date | None = None,
) -> list[dict] | None:
    """Parse a financial email and extract transaction data.

    Returns a list of transaction dicts, or None if not a transaction email.
    """
    from datetime import date as date_type

    from openai import AsyncOpenAI

    if today is None:
        today = date_type.today()

    # Prefer plain text, fall back to HTML with tags stripped
    body = body_text or _strip_html(body_html)

    # Truncate to avoid huge prompts
    if len(body) > 3000:
        body = body[:3000] + "..."

    user_content = f"Subject: {subject}\n\nBody:\n{body}\n\nToday's date: {today.isoformat()}"

    client = AsyncOpenAI(api_key=openai_api_key)
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            response_format={"type": "json_object"},
            temperature=0,
        )
        content = response.choices[0].message.content or "{}"
        result = json.loads(content)
    except Exception as e:
        logger.warning("Failed to parse email '%s': %s", subject[:50], e)
        return None

    if not result.get("is_transaction"):
        return None

    transactions = result.get("transactions", [])
    if not transactions:
        return None

    parsed = []
    for tx in transactions:
        try:
            tx_date = date_type.fromisoformat(tx.get("date", today.isoformat()))
        except (ValueError, TypeError):
            tx_date = today

        amount = tx.get("amount")
        if amount is None:
            continue

        parsed.append(
            {
                "amount": float(amount),
                "description": str(tx.get("description", subject))[:500],
                "merchant": str(tx.get("merchant", ""))[:255] if tx.get("merchant") else None,
                "transaction_date": tx_date,
                "transaction_type": tx.get("transaction_type", "debit"),
            }
        )

    return parsed if parsed else None


def _strip_html(html: str) -> str:
    """Very basic HTML tag stripping for email bodies."""
    import re

    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return text
