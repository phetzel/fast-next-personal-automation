/**
 * Finance area types.
 */

export type AccountType = "checking" | "savings" | "credit_card" | "investment" | "loan" | "other";

export type TransactionType = "debit" | "credit" | "transfer";

export type TransactionSource = "manual" | "csv_import" | "email_parsed";

export type BillingCycle = "weekly" | "biweekly" | "monthly" | "quarterly" | "annual";

export type TransactionCategory =
  | "income_salary"
  | "income_freelance"
  | "income_investment"
  | "income_refund"
  | "income_other"
  | "housing"
  | "utilities"
  | "groceries"
  | "dining"
  | "transportation"
  | "healthcare"
  | "entertainment"
  | "shopping"
  | "subscriptions"
  | "travel"
  | "education"
  | "personal_care"
  | "fitness"
  | "pets"
  | "gifts_donations"
  | "business"
  | "taxes"
  | "transfer"
  | "other";

export const INCOME_CATEGORIES: TransactionCategory[] = [
  "income_salary",
  "income_freelance",
  "income_investment",
  "income_refund",
  "income_other",
];

export const EXPENSE_CATEGORIES: TransactionCategory[] = [
  "housing",
  "utilities",
  "groceries",
  "dining",
  "transportation",
  "healthcare",
  "entertainment",
  "shopping",
  "subscriptions",
  "travel",
  "education",
  "personal_care",
  "fitness",
  "pets",
  "gifts_donations",
  "business",
  "taxes",
  "transfer",
  "other",
];

export const ALL_CATEGORIES: TransactionCategory[] = [...INCOME_CATEGORIES, ...EXPENSE_CATEGORIES];

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  income_salary: "Salary",
  income_freelance: "Freelance",
  income_investment: "Investment Returns",
  income_refund: "Refund",
  income_other: "Other Income",
  housing: "Housing",
  utilities: "Utilities",
  groceries: "Groceries",
  dining: "Dining",
  transportation: "Transportation",
  healthcare: "Healthcare",
  entertainment: "Entertainment",
  shopping: "Shopping",
  subscriptions: "Subscriptions",
  travel: "Travel",
  education: "Education",
  personal_care: "Personal Care",
  fitness: "Fitness",
  pets: "Pets",
  gifts_donations: "Gifts & Donations",
  business: "Business",
  taxes: "Taxes",
  transfer: "Transfer",
  other: "Other",
};

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
  category: TransactionCategory | null;
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
  category?: TransactionCategory;
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
  category?: TransactionCategory | null;
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
  category?: TransactionCategory | null;
  account_id?: string | null;
  recurring_expense_id?: string | null;
  is_reviewed?: boolean;
  notes?: string | null;
}

export interface Budget {
  id: string;
  user_id: string;
  category: TransactionCategory;
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
  category: TransactionCategory | null;
  expected_amount: number | null;
  billing_cycle: BillingCycle;
  next_due_date: string | null;
  last_seen_date: string | null;
  is_active: boolean;
  auto_match: boolean;
  notes: string | null;
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
