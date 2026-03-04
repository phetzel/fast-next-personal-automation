"""Billing cycle date arithmetic utilities."""

from datetime import date


def advance_billing_cycle(d: date, billing_cycle: str) -> date:
    """Advance a date by one billing cycle interval.

    Args:
        d: The starting date.
        billing_cycle: One of "weekly", "biweekly", "monthly", "quarterly", "annual".

    Returns:
        The date advanced by one cycle.
    """
    from calendar import monthrange
    from datetime import timedelta

    if billing_cycle == "weekly":
        return d + timedelta(days=7)
    if billing_cycle == "biweekly":
        return d + timedelta(days=14)
    if billing_cycle == "quarterly":
        month = d.month - 1 + 3
        year = d.year + month // 12
        month = month % 12 + 1
        day = min(d.day, monthrange(year, month)[1])
        return date(year, month, day)
    if billing_cycle == "annual":
        try:
            return d.replace(year=d.year + 1)
        except ValueError:  # Feb 29 on non-leap year
            return d.replace(year=d.year + 1, day=28)
    # monthly (default)
    month = d.month - 1 + 1
    year = d.year + month // 12
    month = month % 12 + 1
    day = min(d.day, monthrange(year, month)[1])
    return date(year, month, day)
