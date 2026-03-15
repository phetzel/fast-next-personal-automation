"use client";

import { useCallback, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import {
  useAccountsQuery,
  useBudgetStatusQuery,
  useCategoriesQuery,
  useFinanceStatsQuery,
  useRecurringExpensesQuery,
  useTransactionsQuery,
} from "./queries/finances";
import type {
  BudgetStatus,
  CSVImportRequest,
  CSVImportResponse,
  FinanceCategory,
  FinancialAccount,
  FinanceStats,
  RecurringExpense,
  Transaction,
  TransactionCreate,
  TransactionFilters,
  TransactionListResponse,
  TransactionUpdate,
} from "@/types";
import { toSearchParams } from "./queries/utils";

const defaultFilters: TransactionFilters = {
  page: 1,
  page_size: 50,
  sort_by: "transaction_date",
  sort_order: "desc",
};

interface UseFinancesOptions {
  initialFilters?: Partial<TransactionFilters>;
  budgetMonthYear?: { month: number; year: number } | null;
  categoriesActiveOnly?: boolean;
  recurringActiveOnly?: boolean;
}

export function useFinances(options?: UseFinancesOptions) {
  const queryClient = useQueryClient();
  const initialFilters = { ...defaultFilters, ...options?.initialFilters };
  const [filters, setFiltersState] = useState<TransactionFilters>(initialFilters);
  const [localBudgetRequest, setLocalBudgetRequest] = useState<{
    month: number;
    year: number;
  } | null>(options?.budgetMonthYear ?? null);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(initialFilters);

  filtersRef.current = filters;
  const budgetRequest = options?.budgetMonthYear ?? localBudgetRequest;

  const accountsQuery = useAccountsQuery();
  const statsQuery = useFinanceStatsQuery();
  const transactionsQuery = useTransactionsQuery(filters);
  const categoriesQuery = useCategoriesQuery(options?.categoriesActiveOnly ?? true);
  const recurringQuery = useRecurringExpensesQuery(options?.recurringActiveOnly ?? true);
  const budgetStatusQuery = useBudgetStatusQuery(
    budgetRequest?.month ?? 1,
    budgetRequest?.year ?? 1970,
    budgetRequest !== null
  );

  const invalidateAllFinances = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.finances.all });
  }, [queryClient]);

  const createAccountMutation = useMutation({
    mutationFn: (data: Partial<FinancialAccount>) =>
      apiClient.post<FinancialAccount>("/finances/accounts", data),
    onSuccess: invalidateAllFinances,
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to create account");
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: ({ accountId, data }: { accountId: string; data: Partial<FinancialAccount> }) =>
      apiClient.patch<FinancialAccount>(`/finances/accounts/${accountId}`, data),
    onSuccess: invalidateAllFinances,
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to update account");
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (accountId: string) => apiClient.delete(`/finances/accounts/${accountId}`),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to delete account");
    },
  });

  const updateBalanceMutation = useMutation({
    mutationFn: ({ accountId, balance }: { accountId: string; balance: number }) =>
      apiClient.patch<FinancialAccount>(`/finances/accounts/${accountId}/balance`, {
        current_balance: balance,
      }),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to update balance");
    },
  });

  const createTransactionMutation = useMutation({
    mutationFn: (data: TransactionCreate | object) =>
      apiClient.post<Transaction>("/finances/transactions", data),
    onSuccess: invalidateAllFinances,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to create transaction"
      );
    },
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({ txId, data }: { txId: string; data: TransactionUpdate }) =>
      apiClient.patch<Transaction>(`/finances/transactions/${txId}`, data),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to update transaction");
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: (txId: string) => apiClient.delete(`/finances/transactions/${txId}`),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to delete transaction");
    },
  });

  const markReviewedMutation = useMutation({
    mutationFn: (txId: string) =>
      apiClient.post<Transaction>(`/finances/transactions/${txId}/review`, {}),
    onSuccess: invalidateAllFinances,
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: object) => apiClient.post("/finances/budgets", data),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to create budget");
    },
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ budgetId, data }: { budgetId: string; data: object }) =>
      apiClient.patch(`/finances/budgets/${budgetId}`, data),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to update budget");
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (budgetId: string) => apiClient.delete(`/finances/budgets/${budgetId}`),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to delete budget");
    },
  });

  const createRecurringMutation = useMutation({
    mutationFn: (data: object) => apiClient.post<RecurringExpense>("/finances/recurring", data),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to create recurring expense");
    },
  });

  const updateRecurringMutation = useMutation({
    mutationFn: ({ recurringId, data }: { recurringId: string; data: object }) =>
      apiClient.patch<RecurringExpense>(`/finances/recurring/${recurringId}`, data),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to update recurring expense");
    },
  });

  const deleteRecurringMutation = useMutation({
    mutationFn: (recurringId: string) => apiClient.delete(`/finances/recurring/${recurringId}`),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to delete recurring expense");
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (data: object) => apiClient.post<FinanceCategory>("/finances/categories", data),
    onSuccess: invalidateAllFinances,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to create category"
      );
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ categoryId, data }: { categoryId: string; data: object }) =>
      apiClient.patch<FinanceCategory>(`/finances/categories/${categoryId}`, data),
    onSuccess: invalidateAllFinances,
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error ? mutationError.message : "Failed to update category"
      );
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: (categoryId: string) => apiClient.delete(`/finances/categories/${categoryId}`),
    onSuccess: invalidateAllFinances,
    onError: () => {
      setError("Failed to delete category");
    },
  });

  const fetchAccounts = useCallback(async () => {
    setError(null);
    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.finances.accounts(),
        queryFn: () => apiClient.get<FinancialAccount[]>("/finances/accounts"),
      });
    } catch {
      return [];
    }
  }, [queryClient]);

  const fetchTransactions = useCallback(
    async (customFilters?: Partial<TransactionFilters>) => {
      const nextFilters = { ...filtersRef.current, ...customFilters };
      const queryString = toSearchParams(nextFilters);

      setFiltersState(nextFilters);
      setError(null);

      try {
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.finances.transactions(nextFilters),
          queryFn: () =>
            apiClient.get<TransactionListResponse>(
              queryString ? `/finances/transactions?${queryString}` : "/finances/transactions"
            ),
        });
        return response.transactions;
      } catch (queryError) {
        const message =
          queryError instanceof Error ? queryError.message : "Failed to fetch transactions";
        setError(message);
        return [];
      }
    },
    [queryClient]
  );

  const fetchStats = useCallback(async () => {
    setError(null);

    try {
      return await queryClient.fetchQuery({
        queryKey: queryKeys.finances.stats(),
        queryFn: () => apiClient.get<FinanceStats>("/finances/stats"),
      });
    } catch {
      return null;
    }
  }, [queryClient]);

  const fetchBudgetStatus = useCallback(
    async (month: number, year: number) => {
      setLocalBudgetRequest({ month, year });
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: queryKeys.finances.budgetStatus(month, year),
          queryFn: () =>
            apiClient.get<BudgetStatus[]>(`/finances/budgets/status?month=${month}&year=${year}`),
        });
      } catch {
        return [];
      }
    },
    [queryClient]
  );

  const fetchRecurring = useCallback(
    async (activeOnly = true) => {
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: queryKeys.finances.recurring({ activeOnly }),
          queryFn: () =>
            apiClient.get<RecurringExpense[]>(`/finances/recurring?active_only=${activeOnly}`),
        });
      } catch {
        return [];
      }
    },
    [queryClient]
  );

  const fetchCategories = useCallback(
    async (activeOnly = true) => {
      setError(null);

      try {
        return await queryClient.fetchQuery({
          queryKey: queryKeys.finances.categories({ activeOnly }),
          queryFn: () =>
            apiClient.get<FinanceCategory[]>(`/finances/categories?active_only=${activeOnly}`),
        });
      } catch {
        return [];
      }
    },
    [queryClient]
  );

  return {
    accounts: accountsQuery.data ?? [],
    accountsLoading: accountsQuery.isLoading || accountsQuery.isFetching,
    transactions: transactionsQuery.data?.transactions ?? [],
    total: transactionsQuery.data?.total ?? 0,
    isLoading:
      transactionsQuery.isLoading ||
      transactionsQuery.isFetching ||
      createTransactionMutation.isPending ||
      updateTransactionMutation.isPending ||
      deleteTransactionMutation.isPending,
    error:
      error ??
      (transactionsQuery.error instanceof Error
        ? transactionsQuery.error.message
        : accountsQuery.error instanceof Error
          ? accountsQuery.error.message
          : null),
    filters,
    stats: statsQuery.data ?? null,
    statsLoading: statsQuery.isLoading || statsQuery.isFetching,
    budgetStatus: budgetStatusQuery.data ?? [],
    budgetsLoading: budgetStatusQuery.isLoading || budgetStatusQuery.isFetching,
    recurringExpenses: recurringQuery.data ?? [],
    recurringLoading: recurringQuery.isLoading || recurringQuery.isFetching,
    categories: categoriesQuery.data ?? [],
    categoriesLoading: categoriesQuery.isLoading || categoriesQuery.isFetching,
    selectedTransaction,
    hasMore:
      transactionsQuery.data?.has_more ??
      (filters.page ?? 1) * (filters.page_size ?? 50) < (transactionsQuery.data?.total ?? 0),
    fetchAccounts,
    createAccount: async (data: Partial<FinancialAccount>) => {
      setError(null);
      try {
        return await createAccountMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateAccount: async (accountId: string, data: Partial<FinancialAccount>) => {
      setError(null);
      try {
        return await updateAccountMutation.mutateAsync({ accountId, data });
      } catch {
        return null;
      }
    },
    deleteAccount: async (accountId: string) => {
      setError(null);
      try {
        await deleteAccountMutation.mutateAsync(accountId);
        return true;
      } catch {
        return false;
      }
    },
    updateBalance: async (accountId: string, balance: number) => {
      setError(null);
      try {
        return await updateBalanceMutation.mutateAsync({ accountId, balance });
      } catch {
        return null;
      }
    },
    fetchTransactions,
    fetchStats,
    createTransaction: async (data: TransactionCreate | object) => {
      setError(null);
      try {
        return await createTransactionMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateTransaction: async (txId: string, data: TransactionUpdate) => {
      setError(null);
      try {
        return await updateTransactionMutation.mutateAsync({ txId, data });
      } catch {
        return null;
      }
    },
    deleteTransaction: async (txId: string) => {
      setError(null);
      try {
        await deleteTransactionMutation.mutateAsync(txId);
        return true;
      } catch {
        return false;
      }
    },
    markReviewed: async (txId: string) => {
      setError(null);
      try {
        return await markReviewedMutation.mutateAsync(txId);
      } catch {
        return null;
      }
    },
    importCSV: async (data: CSVImportRequest): Promise<CSVImportResponse | null> => {
      setError(null);
      try {
        const result = await apiClient.post<CSVImportResponse>(
          "/finances/transactions/import-csv",
          data
        );
        await invalidateAllFinances();
        return result;
      } catch (mutationError) {
        setError(mutationError instanceof Error ? mutationError.message : "Failed to import CSV");
        return null;
      }
    },
    triggerCategorize: async (limit = 100, accountId?: string) => {
      setError(null);
      try {
        const result = await apiClient.post<{ categorized: number; failed: number }>(
          "/finances/transactions/categorize",
          {
            limit,
            account_id: accountId ?? null,
          }
        );
        await invalidateAllFinances();
        return result;
      } catch {
        return null;
      }
    },
    fetchBudgetStatus,
    createBudget: async (data: object) => {
      setError(null);
      try {
        await createBudgetMutation.mutateAsync(data);
        return true;
      } catch {
        return false;
      }
    },
    updateBudget: async (budgetId: string, data: object) => {
      setError(null);
      try {
        await updateBudgetMutation.mutateAsync({ budgetId, data });
        return true;
      } catch {
        return false;
      }
    },
    deleteBudget: async (budgetId: string) => {
      setError(null);
      try {
        await deleteBudgetMutation.mutateAsync(budgetId);
        return true;
      } catch {
        return false;
      }
    },
    fetchRecurring,
    createRecurring: async (data: object) => {
      setError(null);
      try {
        return await createRecurringMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateRecurring: async (recurringId: string, data: object) => {
      setError(null);
      try {
        return await updateRecurringMutation.mutateAsync({ recurringId, data });
      } catch {
        return null;
      }
    },
    deleteRecurring: async (recurringId: string) => {
      setError(null);
      try {
        await deleteRecurringMutation.mutateAsync(recurringId);
        return true;
      } catch {
        return false;
      }
    },
    fetchCategories,
    createCategory: async (data: object) => {
      setError(null);
      try {
        return await createCategoryMutation.mutateAsync(data);
      } catch {
        return null;
      }
    },
    updateCategory: async (categoryId: string, data: object) => {
      setError(null);
      try {
        return await updateCategoryMutation.mutateAsync({ categoryId, data });
      } catch {
        return null;
      }
    },
    deleteCategory: async (categoryId: string) => {
      setError(null);
      try {
        await deleteCategoryMutation.mutateAsync(categoryId);
        return true;
      } catch {
        return false;
      }
    },
    setFilters: (newFilters: Partial<TransactionFilters>) =>
      setFiltersState((currentFilters) => ({ ...currentFilters, ...newFilters })),
    resetFilters: () => setFiltersState(initialFilters),
    setSelectedTransaction,
    goToPage: (page: number) => setFiltersState((currentFilters) => ({ ...currentFilters, page })),
  };
}
