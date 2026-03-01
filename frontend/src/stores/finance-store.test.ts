import { describe, it, expect, beforeEach } from "vitest";
import { useFinanceStore } from "./finance-store";
import type { FinancialAccount, Transaction, RecurringExpense, FinanceStats } from "@/types";

// ──────────────────── Factories ───────────────────────────────────────────────

const makeAccount = (overrides?: Partial<FinancialAccount>): FinancialAccount => ({
  id: "acct-1",
  user_id: "user-1",
  name: "Checking",
  institution: "Test Bank",
  account_type: "checking",
  last_four: "1234",
  currency: "USD",
  current_balance: 1000,
  balance_updated_at: null,
  is_active: true,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: null,
  ...overrides,
});

const makeTransaction = (overrides?: Partial<Transaction>): Transaction => ({
  id: "tx-1",
  user_id: "user-1",
  account_id: null,
  recurring_expense_id: null,
  amount: -42.5,
  description: "Coffee",
  merchant: "Blue Bottle",
  transaction_date: "2026-03-01",
  posted_date: null,
  transaction_type: "debit",
  category: "dining",
  category_confidence: null,
  source: "manual",
  raw_email_id: null,
  is_reviewed: false,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: null,
  ...overrides,
});

const makeRecurring = (overrides?: Partial<RecurringExpense>): RecurringExpense => ({
  id: "rec-1",
  user_id: "user-1",
  name: "Netflix",
  merchant: "NETFLIX",
  category: "subscriptions",
  expected_amount: 15.99,
  billing_cycle: "monthly",
  next_due_date: null,
  last_seen_date: null,
  is_active: true,
  auto_match: true,
  notes: null,
  created_at: new Date().toISOString(),
  updated_at: null,
  ...overrides,
});

const makeStats = (): FinanceStats => ({
  total_accounts: 2,
  current_month_income: 3000,
  current_month_expenses: 500,
  current_month_net: 2500,
  current_month_transactions: 10,
  unreviewed_count: 3,
  active_recurring_count: 4,
});

// ──────────────────── Tests ───────────────────────────────────────────────────

describe("Finance Store", () => {
  beforeEach(() => {
    useFinanceStore.setState({
      accounts: [],
      accountsLoading: false,
      transactions: [],
      total: 0,
      isLoading: false,
      error: null,
      filters: { page: 1, page_size: 50, sort_by: "transaction_date", sort_order: "desc" },
      selectedTransaction: null,
      stats: null,
      statsLoading: false,
      budgetStatus: [],
      budgetsLoading: false,
      recurringExpenses: [],
      recurringLoading: false,
    });
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  it("should have correct initial state", () => {
    const state = useFinanceStore.getState();
    expect(state.accounts).toEqual([]);
    expect(state.transactions).toEqual([]);
    expect(state.total).toBe(0);
    expect(state.stats).toBeNull();
    expect(state.error).toBeNull();
    expect(state.filters.page).toBe(1);
    expect(state.filters.sort_order).toBe("desc");
  });

  // ── Account actions ───────────────────────────────────────────────────────

  it("should set accounts", () => {
    const account = makeAccount();
    useFinanceStore.getState().setAccounts([account]);
    expect(useFinanceStore.getState().accounts).toHaveLength(1);
    expect(useFinanceStore.getState().accounts[0].name).toBe("Checking");
  });

  it("should update an account in-place", () => {
    const account = makeAccount();
    useFinanceStore.getState().setAccounts([account]);
    useFinanceStore.getState().updateAccount({ ...account, name: "Updated Checking" });
    expect(useFinanceStore.getState().accounts[0].name).toBe("Updated Checking");
  });

  it("should remove an account by id", () => {
    useFinanceStore.getState().setAccounts([makeAccount({ id: "a1" }), makeAccount({ id: "a2" })]);
    useFinanceStore.getState().removeAccount("a1");
    const accounts = useFinanceStore.getState().accounts;
    expect(accounts).toHaveLength(1);
    expect(accounts[0].id).toBe("a2");
  });

  // ── Transaction actions ───────────────────────────────────────────────────

  it("should set transactions and total", () => {
    const tx = makeTransaction();
    useFinanceStore.getState().setTransactions([tx], 1);
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
    expect(useFinanceStore.getState().total).toBe(1);
    expect(useFinanceStore.getState().error).toBeNull();
  });

  it("should update a transaction in-place", () => {
    const tx = makeTransaction();
    useFinanceStore.getState().setTransactions([tx], 1);
    useFinanceStore.getState().updateTransaction({ ...tx, is_reviewed: true });
    expect(useFinanceStore.getState().transactions[0].is_reviewed).toBe(true);
  });

  it("should update selectedTransaction when updating a matching transaction", () => {
    const tx = makeTransaction();
    useFinanceStore.getState().setTransactions([tx], 1);
    useFinanceStore.setState({ selectedTransaction: tx });
    useFinanceStore.getState().updateTransaction({ ...tx, description: "Updated" });
    expect(useFinanceStore.getState().selectedTransaction?.description).toBe("Updated");
  });

  it("should remove a transaction and decrement total", () => {
    const tx1 = makeTransaction({ id: "tx-1" });
    const tx2 = makeTransaction({ id: "tx-2" });
    useFinanceStore.getState().setTransactions([tx1, tx2], 2);
    useFinanceStore.getState().removeTransaction("tx-1");
    expect(useFinanceStore.getState().transactions).toHaveLength(1);
    expect(useFinanceStore.getState().total).toBe(1);
  });

  it("should clear selectedTransaction when it is removed", () => {
    const tx = makeTransaction({ id: "tx-1" });
    useFinanceStore.getState().setTransactions([tx], 1);
    useFinanceStore.setState({ selectedTransaction: tx });
    useFinanceStore.getState().removeTransaction("tx-1");
    expect(useFinanceStore.getState().selectedTransaction).toBeNull();
  });

  it("should not let total go below 0", () => {
    useFinanceStore.getState().setTransactions([], 0);
    useFinanceStore.getState().removeTransaction("tx-ghost");
    expect(useFinanceStore.getState().total).toBe(0);
  });

  // ── Filter actions ────────────────────────────────────────────────────────

  it("should merge filter updates", () => {
    useFinanceStore.getState().setFilters({ category: "dining" });
    const filters = useFinanceStore.getState().filters;
    expect(filters.category).toBe("dining");
    expect(filters.page).toBe(1); // original values preserved
  });

  it("should reset filters to defaults", () => {
    useFinanceStore.getState().setFilters({ category: "dining", page: 5 });
    useFinanceStore.getState().resetFilters();
    const filters = useFinanceStore.getState().filters;
    expect(filters.category).toBeUndefined();
    expect(filters.page).toBe(1);
    expect(filters.page_size).toBe(50);
  });

  // ── Error and loading ─────────────────────────────────────────────────────

  it("should set and clear error", () => {
    useFinanceStore.getState().setError("Something went wrong");
    expect(useFinanceStore.getState().error).toBe("Something went wrong");
    useFinanceStore.getState().setError(null);
    expect(useFinanceStore.getState().error).toBeNull();
  });

  it("should set loading state", () => {
    useFinanceStore.getState().setLoading(true);
    expect(useFinanceStore.getState().isLoading).toBe(true);
    useFinanceStore.getState().setLoading(false);
    expect(useFinanceStore.getState().isLoading).toBe(false);
  });

  // ── Stats ─────────────────────────────────────────────────────────────────

  it("should set stats", () => {
    const stats = makeStats();
    useFinanceStore.getState().setStats(stats);
    expect(useFinanceStore.getState().stats?.current_month_net).toBe(2500);
    expect(useFinanceStore.getState().stats?.unreviewed_count).toBe(3);
  });

  it("should clear stats", () => {
    useFinanceStore.getState().setStats(makeStats());
    useFinanceStore.getState().setStats(null);
    expect(useFinanceStore.getState().stats).toBeNull();
  });

  // ── Recurring expenses ────────────────────────────────────────────────────

  it("should set recurring expenses", () => {
    useFinanceStore.getState().setRecurringExpenses([makeRecurring()]);
    expect(useFinanceStore.getState().recurringExpenses).toHaveLength(1);
  });

  it("should update a recurring expense in-place", () => {
    const rec = makeRecurring();
    useFinanceStore.getState().setRecurringExpenses([rec]);
    useFinanceStore.getState().updateRecurring({ ...rec, name: "Disney+" });
    expect(useFinanceStore.getState().recurringExpenses[0].name).toBe("Disney+");
  });

  it("should remove a recurring expense by id", () => {
    useFinanceStore.getState().setRecurringExpenses([
      makeRecurring({ id: "r1" }),
      makeRecurring({ id: "r2" }),
    ]);
    useFinanceStore.getState().removeRecurring("r1");
    expect(useFinanceStore.getState().recurringExpenses).toHaveLength(1);
    expect(useFinanceStore.getState().recurringExpenses[0].id).toBe("r2");
  });
});
