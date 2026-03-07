/**
 * Finance area types.
 */

export type AccountType = "checking" | "savings" | "credit_card" | "investment" | "loan" | "other";

export type TransactionType = "debit" | "credit" | "transfer";

export type TransactionSource = "manual" | "csv_import" | "email_parsed";

export type BillingCycle = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

export interface FinanceCategory {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  category_type: "income" | "expense";
  color: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  checking: "Checking",
  savings: "Savings",
  credit_card: "Credit Card",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

export const BILLING_CYCLE_LABELS: Record<BillingCycle, string> = {
  weekly: "Weekly",
  biweekly: "Bi-Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  annual: "Annual",
};

// ──────────────────── API Types ────────────────────────────────────────────

export interface FinancialAccount {
  id: string;
  user_id: string;
  name: string;
  institution: string | null;
  account_type: AccountType;
  last_four: string | null;
  currency: string;
  current_balance: number | null;
  balance_updated_at: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string | null;
  recurring_expense_id: string | null;
  amount: number;
  description: string;
  merchant: string | null;
  transaction_date: string; // ISO date YYYY-MM-DD
  posted_date: string | null;
  transaction_type: TransactionType;
  category: string | null;
  category_confidence: number | null;
  source: TransactionSource;
  raw_email_id: string | null;
  is_reviewed: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TransactionFilters {
  account_id?: string;
  category?: string;
  source?: TransactionSource;
  transaction_type?: TransactionType;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  max_amount?: number;
  search?: string;
  is_reviewed?: boolean;
  page?: number;
  page_size?: number;
  sort_by?: "transaction_date" | "amount" | "merchant" | "created_at";
  sort_order?: "asc" | "desc";
}

export interface TransactionListResponse {
  transactions: Transaction[];
  total: number;
  page: number;
  page_size: number;
  has_more: boolean;
}

export interface TransactionCreate {
  amount: number;
  description: string;
  transaction_date: string;
  transaction_type?: TransactionType;
  merchant?: string | null;
  category?: string | null;
  account_id?: string | null;
  notes?: string | null;
  source?: TransactionSource;
}

export interface TransactionUpdate {
  amount?: number;
  description?: string;
  merchant?: string | null;
  transaction_date?: string;
  posted_date?: string | null;
  transaction_type?: TransactionType;
  category?: string | null;
  account_id?: string | null;
  recurring_expense_id?: string | null;
  is_reviewed?: boolean;
  notes?: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category: string | null;
  month: number;
  year: number;
  amount_limit: number;
  notes: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface BudgetStatus {
  budget: Budget;
  spent_amount: number;
  remaining: number;
  transactions_count: number;
  is_over_budget: boolean;
}

export interface RecurringExpense {
  id: string;
  user_id: string;
  name: string;
  merchant: string | null;
  category: string | null;
  expected_amount: number | null;
  billing_cycle: BillingCycle;
  next_due_date: string | null;
  last_seen_date: string | null;
  is_active: boolean;
  auto_match: boolean;
  notes: string | null;
  account_id: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface FinanceStats {
  total_accounts: number;
  current_month_income: number;
  current_month_expenses: number;
  current_month_net: number;
  current_month_transactions: number;
  unreviewed_count: number;
  active_recurring_count: number;
}

export interface CSVImportRequest {
  account_id?: string | null;
  csv_content: string;
  date_column?: string;
  description_column?: string;
  amount_column?: string;
  date_format?: string;
}

export interface CSVImportResponse {
  imported: number;
  skipped_duplicates: number;
  errors: string[];
}
