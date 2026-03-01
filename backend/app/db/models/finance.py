"""Finance database models for tracking accounts, transactions, budgets, and recurring expenses."""

import uuid
from datetime import date, datetime
from decimal import Decimal
from enum import StrEnum
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy import text as sa_text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.db.models.user import User


class AccountType(StrEnum):
    CHECKING = "checking"
    SAVINGS = "savings"
    CREDIT_CARD = "credit_card"
    INVESTMENT = "investment"
    LOAN = "loan"
    OTHER = "other"


class TransactionType(StrEnum):
    DEBIT = "debit"
    CREDIT = "credit"
    TRANSFER = "transfer"


class TransactionSource(StrEnum):
    MANUAL = "manual"
    CSV_IMPORT = "csv_import"
    EMAIL_PARSED = "email_parsed"


class BillingCycle(StrEnum):
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    ANNUAL = "annual"


class TransactionCategory(StrEnum):
    # Income
    INCOME_SALARY = "income_salary"
    INCOME_FREELANCE = "income_freelance"
    INCOME_INVESTMENT = "income_investment"
    INCOME_REFUND = "income_refund"
    INCOME_OTHER = "income_other"
    # Expenses
    HOUSING = "housing"
    UTILITIES = "utilities"
    GROCERIES = "groceries"
    DINING = "dining"
    TRANSPORTATION = "transportation"
    HEALTHCARE = "healthcare"
    ENTERTAINMENT = "entertainment"
    SHOPPING = "shopping"
    SUBSCRIPTIONS = "subscriptions"
    TRAVEL = "travel"
    EDUCATION = "education"
    PERSONAL_CARE = "personal_care"
    FITNESS = "fitness"
    PETS = "pets"
    GIFTS_DONATIONS = "gifts_donations"
    BUSINESS = "business"
    TAXES = "taxes"
    TRANSFER = "transfer"
    OTHER = "other"


class FinancialAccount(Base, TimestampMixin):
    """A financial account (bank account, credit card, investment, etc.)."""

    __tablename__ = "financial_accounts"
    __table_args__ = (
        UniqueConstraint("user_id", "name", name="financial_accounts_user_id_name_key"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    institution: Mapped[str | None] = mapped_column(String(255), nullable=True)
    account_type: Mapped[str] = mapped_column(String(50), nullable=False, default=AccountType.CHECKING.value)
    last_four: Mapped[str | None] = mapped_column(String(4), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="USD")
    current_balance: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    balance_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="account", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<FinancialAccount(id={self.id}, name={self.name}, type={self.account_type})>"


class Transaction(Base, TimestampMixin):
    """A single financial transaction.

    amount: positive = income/credit, negative = expense/debit
    raw_email_id: Gmail message ID used for deduplication of email-parsed transactions
    """

    __tablename__ = "transactions"
    __table_args__ = (
        # Partial unique index: only enforce uniqueness on raw_email_id when it's not null
        Index(
            "transactions_user_id_raw_email_id_idx",
            "user_id",
            "raw_email_id",
            unique=True,
            postgresql_where=sa_text("raw_email_id IS NOT NULL"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    account_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("financial_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    recurring_expense_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("recurring_expenses.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Core transaction data
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    merchant: Mapped[str | None] = mapped_column(String(255), nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    posted_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False, default=TransactionType.DEBIT.value)

    # Categorization (AI-assigned, user-overridable)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    category_confidence: Mapped[float | None] = mapped_column(Numeric(4, 3), nullable=True)

    # Ingestion metadata
    source: Mapped[str] = mapped_column(String(20), nullable=False, default=TransactionSource.MANUAL.value, index=True)
    raw_email_id: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # User review status
    is_reviewed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    account: Mapped["FinancialAccount | None"] = relationship(
        "FinancialAccount", back_populates="transactions", lazy="selectin"
    )
    recurring_expense: Mapped["RecurringExpense | None"] = relationship(
        "RecurringExpense", back_populates="transactions", lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Transaction(id={self.id}, amount={self.amount}, description={self.description[:30]})>"


class Budget(Base, TimestampMixin):
    """A monthly spending budget for a specific category."""

    __tablename__ = "budgets"
    __table_args__ = (
        UniqueConstraint(
            "user_id", "category", "month", "year",
            name="budgets_user_id_category_month_year_key",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    month: Mapped[int] = mapped_column(nullable=False)  # 1-12
    year: Mapped[int] = mapped_column(nullable=False)
    amount_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")

    def __repr__(self) -> str:
        return f"<Budget(id={self.id}, category={self.category}, {self.month}/{self.year}, limit={self.amount_limit})>"


class RecurringExpense(Base, TimestampMixin):
    """A recurring subscription, bill, or expense.

    Used to track expected recurring payments and auto-link matching transactions.
    """

    __tablename__ = "recurring_expenses"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    merchant: Mapped[str | None] = mapped_column(String(255), nullable=True)
    category: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    expected_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    billing_cycle: Mapped[str] = mapped_column(String(20), nullable=False, default=BillingCycle.MONTHLY.value)
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    last_seen_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    auto_match: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    user: Mapped["User"] = relationship("User", lazy="selectin")
    transactions: Mapped[list["Transaction"]] = relationship(
        "Transaction", back_populates="recurring_expense", lazy="noload"
    )

    def __repr__(self) -> str:
        return f"<RecurringExpense(id={self.id}, name={self.name}, cycle={self.billing_cycle})>"
