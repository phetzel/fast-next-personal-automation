"use client";

import { useCallback } from "react";
import { useFinanceStore } from "@/stores/finance-store";
import { apiClient } from "@/lib/api-client";
import type {
  BudgetStatus,
  CSVImportRequest,
  CSVImportResponse,
  FinancialAccount,
  FinanceStats,
  RecurringExpense,
  Transaction,
  TransactionFilters,
  TransactionListResponse,
  TransactionUpdate,
} from "@/types";

/**
 * Hook for managing finances data and API interactions.
 */
export function useFinances() {
  const {
    accounts,
    accountsLoading,
    transactions,
    total,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    budgetStatus,
    budgetsLoading,
    recurringExpenses,
    recurringLoading,
    selectedTransaction,
    setAccounts,
    setAccountsLoading,
    updateAccount,
    removeAccount,
    setTransactions,
    setLoading,
    setError,
    setFilters,
    resetFilters,
    setSelectedTransaction,
    updateTransaction,
    removeTransaction,
    setStats,
    setStatsLoading,
    setBudgetStatus,
    setBudgetsLoading,
    setRecurringExpenses,
    setRecurringLoading,
    updateRecurring,
    removeRecurring,
  } = useFinanceStore();

  // ──────────────────── Accounts ────────────────────────────────────────

  const fetchAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const data = await apiClient.get<FinancialAccount[]>("/finances/accounts");
      setAccounts(data);
    } catch {
      // Silently fail — not critical
    } finally {
      setAccountsLoading(false);
    }
  }, [setAccounts, setAccountsLoading]);

  const createAccount = useCallback(
    async (data: Partial<FinancialAccount>): Promise<FinancialAccount | null> => {
      try {
        const account = await apiClient.post<FinancialAccount>("/finances/accounts", data);
        setAccounts([...accounts, account]);
        return account;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create account");
        return null;
      }
    },
    [accounts, setAccounts, setError]
  );

  const updateAccountData = useCallback(
    async (accountId: string, data: Partial<FinancialAccount>): Promise<FinancialAccount | null> => {
      try {
        const account = await apiClient.patch<FinancialAccount>(
          `/finances/accounts/${accountId}`,
          data
        );
        updateAccount(account);
        return account;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to update account");
        return null;
      }
    },
    [updateAccount, setError]
  );

  const deleteAccount = useCallback(
    async (accountId: string): Promise<boolean> => {
      try {
        await apiClient.delete(`/finances/accounts/${accountId}`);
        removeAccount(accountId);
        return true;
      } catch {
        setError("Failed to delete account");
        return false;
      }
    },
    [removeAccount, setError]
  );

  const updateBalance = useCallback(
    async (accountId: string, balance: number): Promise<FinancialAccount | null> => {
      try {
        const account = await apiClient.patch<FinancialAccount>(
          `/finances/accounts/${accountId}/balance`,
          { current_balance: balance }
        );
        updateAccount(account);
        return account;
      } catch {
        setError("Failed to update balance");
        return null;
      }
    },
    [updateAccount, setError]
  );

  // ──────────────────── Transactions ────────────────────────────────────

  const fetchTransactions = useCallback(
    async (customFilters?: Partial<TransactionFilters>) => {
      setLoading(true);
      setError(null);

      try {
        const applied = { ...filters, ...customFilters };
        const params = new URLSearchParams();

        if (applied.account_id) params.set("account_id", applied.account_id);
        if (applied.category) params.set("category", applied.category);
        if (applied.source) params.set("source", applied.source);
        if (applied.transaction_type) params.set("transaction_type", applied.transaction_type);
        if (applied.date_from) params.set("date_from", applied.date_from);
        if (applied.date_to) params.set("date_to", applied.date_to);
        if (applied.min_amount !== undefined) params.set("min_amount", String(applied.min_amount));
        if (applied.max_amount !== undefined) params.set("max_amount", String(applied.max_amount));
        if (applied.search) params.set("search", applied.search);
        if (applied.is_reviewed !== undefined)
          params.set("is_reviewed", String(applied.is_reviewed));
        if (applied.page) params.set("page", String(applied.page));
        if (applied.page_size) params.set("page_size", String(applied.page_size));
        if (applied.sort_by) params.set("sort_by", applied.sort_by);
        if (applied.sort_order) params.set("sort_order", applied.sort_order);

        const response = await apiClient.get<TransactionListResponse>(
          `/finances/transactions?${params.toString()}`
        );
        setTransactions(response.transactions, response.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to fetch transactions");
      } finally {
        setLoading(false);
      }
    },
    [filters, setTransactions, setLoading, setError]
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await apiClient.get<FinanceStats>("/finances/stats");
      setStats(data);
    } catch {
      setStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, [setStats, setStatsLoading]);

  const createTransaction = useCallback(
    async (data: object): Promise<Transaction | null> => {
      try {
        const tx = await apiClient.post<Transaction>("/finances/transactions", data);
        setTransactions([tx, ...transactions], total + 1);
        return tx;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create transaction");
        return null;
      }
    },
    [transactions, total, setTransactions, setError]
  );

  const updateTransactionData = useCallback(
    async (txId: string, data: TransactionUpdate): Promise<Transaction | null> => {
      try {
        const tx = await apiClient.patch<Transaction>(`/finances/transactions/${txId}`, data);
        updateTransaction(tx);
        return tx;
      } catch {
        setError("Failed to update transaction");
        return null;
      }
    },
    [updateTransaction, setError]
  );

  const deleteTransaction = useCallback(
    async (txId: string): Promise<boolean> => {
      try {
        await apiClient.delete(`/finances/transactions/${txId}`);
        removeTransaction(txId);
        return true;
      } catch {
        setError("Failed to delete transaction");
        return false;
      }
    },
    [removeTransaction, setError]
  );

  const markReviewed = useCallback(
    async (txId: string): Promise<Transaction | null> => {
      try {
        const tx = await apiClient.post<Transaction>(
          `/finances/transactions/${txId}/review`,
          {}
        );
        updateTransaction(tx);
        return tx;
      } catch {
        return null;
      }
    },
    [updateTransaction]
  );

  const importCSV = useCallback(
    async (data: CSVImportRequest): Promise<CSVImportResponse | null> => {
      try {
        return await apiClient.post<CSVImportResponse>(
          "/finances/transactions/import-csv",
          data
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to import CSV");
        return null;
      }
    },
    [setError]
  );

  const triggerCategorize = useCallback(
    async (limit = 100, accountId?: string): Promise<{ categorized: number; failed: number } | null> => {
      try {
        return await apiClient.post("/finances/transactions/categorize", {
          limit,
          account_id: accountId ?? null,
        });
      } catch {
        return null;
      }
    },
    []
  );

  // ──────────────────── Budgets ──────────────────────────────────────────

  const fetchBudgetStatus = useCallback(
    async (month: number, year: number) => {
      setBudgetsLoading(true);
      try {
        const data = await apiClient.get<BudgetStatus[]>(
          `/finances/budgets/status?month=${month}&year=${year}`
        );
        setBudgetStatus(data);
      } catch {
        setBudgetStatus([]);
      } finally {
        setBudgetsLoading(false);
      }
    },
    [setBudgetStatus, setBudgetsLoading]
  );

  const createBudget = useCallback(
    async (data: object): Promise<boolean> => {
      try {
        await apiClient.post("/finances/budgets", data);
        return true;
      } catch {
        setError("Failed to create budget");
        return false;
      }
    },
    [setError]
  );

  const updateBudget = useCallback(
    async (budgetId: string, data: object): Promise<boolean> => {
      try {
        await apiClient.patch(`/finances/budgets/${budgetId}`, data);
        return true;
      } catch {
        setError("Failed to update budget");
        return false;
      }
    },
    [setError]
  );

  const deleteBudget = useCallback(
    async (budgetId: string): Promise<boolean> => {
      try {
        await apiClient.delete(`/finances/budgets/${budgetId}`);
        return true;
      } catch {
        setError("Failed to delete budget");
        return false;
      }
    },
    [setError]
  );

  // ──────────────────── Recurring Expenses ──────────────────────────────

  const fetchRecurring = useCallback(
    async (activeOnly = true) => {
      setRecurringLoading(true);
      try {
        const data = await apiClient.get<RecurringExpense[]>(
          `/finances/recurring?active_only=${activeOnly}`
        );
        setRecurringExpenses(data);
      } catch {
        setRecurringExpenses([]);
      } finally {
        setRecurringLoading(false);
      }
    },
    [setRecurringExpenses, setRecurringLoading]
  );

  const createRecurring = useCallback(
    async (data: object): Promise<RecurringExpense | null> => {
      try {
        const recurring = await apiClient.post<RecurringExpense>("/finances/recurring", data);
        setRecurringExpenses([...recurringExpenses, recurring]);
        return recurring;
      } catch {
        setError("Failed to create recurring expense");
        return null;
      }
    },
    [recurringExpenses, setRecurringExpenses, setError]
  );

  const updateRecurringData = useCallback(
    async (recurringId: string, data: object): Promise<RecurringExpense | null> => {
      try {
        const recurring = await apiClient.patch<RecurringExpense>(
          `/finances/recurring/${recurringId}`,
          data
        );
        updateRecurring(recurring);
        return recurring;
      } catch {
        setError("Failed to update recurring expense");
        return null;
      }
    },
    [updateRecurring, setError]
  );

  const deleteRecurring = useCallback(
    async (recurringId: string): Promise<boolean> => {
      try {
        await apiClient.delete(`/finances/recurring/${recurringId}`);
        removeRecurring(recurringId);
        return true;
      } catch {
        setError("Failed to delete recurring expense");
        return false;
      }
    },
    [removeRecurring, setError]
  );

  const goToPage = useCallback(
    (page: number) => setFilters({ page }),
    [setFilters]
  );

  return {
    // State
    accounts,
    accountsLoading,
    transactions,
    total,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    budgetStatus,
    budgetsLoading,
    recurringExpenses,
    recurringLoading,
    selectedTransaction,
    hasMore: (filters.page ?? 1) * (filters.page_size ?? 50) < total,

    // Accounts
    fetchAccounts,
    createAccount,
    updateAccount: updateAccountData,
    deleteAccount,
    updateBalance,

    // Transactions
    fetchTransactions,
    fetchStats,
    createTransaction,
    updateTransaction: updateTransactionData,
    deleteTransaction,
    markReviewed,
    importCSV,
    triggerCategorize,
    setFilters,
    resetFilters,
    setSelectedTransaction,
    goToPage,

    // Budgets
    fetchBudgetStatus,
    createBudget,
    updateBudget,
    deleteBudget,

    // Recurring
    fetchRecurring,
    createRecurring,
    updateRecurring: updateRecurringData,
    deleteRecurring,
  };
}
