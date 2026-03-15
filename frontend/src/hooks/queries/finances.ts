"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  BudgetStatus,
  FinanceCategory,
  FinanceStats,
  FinancialAccount,
  RecurringExpense,
  TransactionFilters,
  TransactionListResponse,
} from "@/types";
import { toSearchParams } from "./utils";

export function useFinanceStatsQuery() {
  return useQuery({
    queryKey: queryKeys.finances.stats(),
    queryFn: () => apiClient.get<FinanceStats>("/finances/stats"),
  });
}

export function useAccountsQuery() {
  return useQuery({
    queryKey: queryKeys.finances.accounts(),
    queryFn: () => apiClient.get<FinancialAccount[]>("/finances/accounts"),
  });
}

export function useTransactionsQuery(filters: Partial<TransactionFilters>) {
  const queryString = toSearchParams(filters);

  return useQuery({
    queryKey: queryKeys.finances.transactions(filters),
    queryFn: () =>
      apiClient.get<TransactionListResponse>(
        queryString ? `/finances/transactions?${queryString}` : "/finances/transactions"
      ),
  });
}

export function useBudgetStatusQuery(month: number, year: number, enabled = true) {
  return useQuery({
    queryKey: queryKeys.finances.budgetStatus(month, year),
    queryFn: () =>
      apiClient.get<BudgetStatus[]>(`/finances/budgets/status?month=${month}&year=${year}`),
    enabled,
  });
}

export function useRecurringExpensesQuery(activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.finances.recurring({ activeOnly }),
    queryFn: () =>
      apiClient.get<RecurringExpense[]>(`/finances/recurring?active_only=${activeOnly}`),
  });
}

export function useCategoriesQuery(activeOnly = true) {
  return useQuery({
    queryKey: queryKeys.finances.categories({ activeOnly }),
    queryFn: () =>
      apiClient.get<FinanceCategory[]>(`/finances/categories?active_only=${activeOnly}`),
  });
}
