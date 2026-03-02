"use client";

import { create } from "zustand";
import type {
  BudgetStatus,
  FinanceCategory,
  FinancialAccount,
  FinanceStats,
  RecurringExpense,
  Transaction,
  TransactionFilters,
} from "@/types";

interface FinanceStore {
  // Accounts
  accounts: FinancialAccount[];
  accountsLoading: boolean;

  // Transactions
  transactions: Transaction[];
  total: number;
  isLoading: boolean;
  error: string | null;
  filters: TransactionFilters;
  selectedTransaction: Transaction | null;

  // Stats
  stats: FinanceStats | null;
  statsLoading: boolean;

  // Budgets
  budgetStatus: BudgetStatus[];
  budgetsLoading: boolean;

  // Recurring expenses
  recurringExpenses: RecurringExpense[];
  recurringLoading: boolean;

  // Categories
  categories: FinanceCategory[];
  categoriesLoading: boolean;

  // Actions — accounts
  setAccounts: (accounts: FinancialAccount[]) => void;
  setAccountsLoading: (loading: boolean) => void;
  updateAccount: (account: FinancialAccount) => void;
  removeAccount: (accountId: string) => void;

  // Actions — transactions
  setTransactions: (transactions: Transaction[], total: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<TransactionFilters>) => void;
  resetFilters: () => void;
  setSelectedTransaction: (tx: Transaction | null) => void;
  updateTransaction: (tx: Transaction) => void;
  removeTransaction: (txId: string) => void;

  // Actions — stats
  setStats: (stats: FinanceStats | null) => void;
  setStatsLoading: (loading: boolean) => void;

  // Actions — budgets
  setBudgetStatus: (status: BudgetStatus[]) => void;
  setBudgetsLoading: (loading: boolean) => void;

  // Actions — recurring
  setRecurringExpenses: (recurring: RecurringExpense[]) => void;
  setRecurringLoading: (loading: boolean) => void;
  updateRecurring: (recurring: RecurringExpense) => void;
  removeRecurring: (recurringId: string) => void;

  // Actions — categories
  setCategories: (categories: FinanceCategory[]) => void;
  setCategoriesLoading: (loading: boolean) => void;
  updateCategory: (category: FinanceCategory) => void;
  removeCategory: (categoryId: string) => void;
}

const defaultFilters: TransactionFilters = {
  page: 1,
  page_size: 50,
  sort_by: "transaction_date",
  sort_order: "desc",
};

export const useFinanceStore = create<FinanceStore>((set) => ({
  // Initial state
  accounts: [],
  accountsLoading: false,

  transactions: [],
  total: 0,
  isLoading: false,
  error: null,
  filters: defaultFilters,
  selectedTransaction: null,

  stats: null,
  statsLoading: false,

  budgetStatus: [],
  budgetsLoading: false,

  recurringExpenses: [],
  recurringLoading: false,

  categories: [],
  categoriesLoading: false,

  // Account actions
  setAccounts: (accounts) => set({ accounts }),
  setAccountsLoading: (accountsLoading) => set({ accountsLoading }),
  updateAccount: (updated) =>
    set((state) => ({
      accounts: state.accounts.map((a) => (a.id === updated.id ? updated : a)),
    })),
  removeAccount: (accountId) =>
    set((state) => ({
      accounts: state.accounts.filter((a) => a.id !== accountId),
    })),

  // Transaction actions
  setTransactions: (transactions, total) => set({ transactions, total, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),
  resetFilters: () => set({ filters: defaultFilters }),
  setSelectedTransaction: (selectedTransaction) => set({ selectedTransaction }),
  updateTransaction: (updated) =>
    set((state) => ({
      transactions: state.transactions.map((t) => (t.id === updated.id ? updated : t)),
      selectedTransaction:
        state.selectedTransaction?.id === updated.id ? updated : state.selectedTransaction,
    })),
  removeTransaction: (txId) =>
    set((state) => ({
      transactions: state.transactions.filter((t) => t.id !== txId),
      total: Math.max(0, state.total - 1),
      selectedTransaction:
        state.selectedTransaction?.id === txId ? null : state.selectedTransaction,
    })),

  // Stats actions
  setStats: (stats) => set({ stats }),
  setStatsLoading: (statsLoading) => set({ statsLoading }),

  // Budget actions
  setBudgetStatus: (budgetStatus) => set({ budgetStatus }),
  setBudgetsLoading: (budgetsLoading) => set({ budgetsLoading }),

  // Recurring actions
  setRecurringExpenses: (recurringExpenses) => set({ recurringExpenses }),
  setRecurringLoading: (recurringLoading) => set({ recurringLoading }),
  updateRecurring: (updated) =>
    set((state) => ({
      recurringExpenses: state.recurringExpenses.map((r) =>
        r.id === updated.id ? updated : r
      ),
    })),
  removeRecurring: (recurringId) =>
    set((state) => ({
      recurringExpenses: state.recurringExpenses.filter((r) => r.id !== recurringId),
    })),

  // Category actions
  setCategories: (categories) => set({ categories }),
  setCategoriesLoading: (categoriesLoading) => set({ categoriesLoading }),
  updateCategory: (updated) =>
    set((state) => ({
      categories: state.categories.map((c) => (c.id === updated.id ? updated : c)),
    })),
  removeCategory: (categoryId) =>
    set((state) => ({
      categories: state.categories.filter((c) => c.id !== categoryId),
    })),
}));
