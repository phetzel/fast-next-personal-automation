"use client";

import { useEffect } from "react";
import { useFinances } from "@/hooks";
import {
  BudgetStatusPanel,
  FinancesOverviewHeader,
  FinancesQuickActionsGrid,
  FinancesStatsGrid,
  RecentTransactionsPanel,
} from "@/components/screens/dashboard/finances/overview";
import { Separator } from "@/components/ui";

const now = new Date();

export default function FinancesOverviewPage() {
  const {
    stats,
    statsLoading,
    transactions,
    isLoading,
    accounts,
    budgetStatus,
    budgetsLoading,
    fetchStats,
    fetchTransactions,
    fetchAccounts,
    fetchBudgetStatus,
    markReviewed,
  } = useFinances();

  useEffect(() => {
    fetchStats();
    fetchAccounts();
    fetchTransactions({ page: 1, page_size: 10, sort_by: "transaction_date", sort_order: "desc" });
    fetchBudgetStatus(now.getMonth() + 1, now.getFullYear());
  }, [fetchStats, fetchTransactions, fetchAccounts, fetchBudgetStatus]);

  const formatCurrency = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="space-y-6">
      <FinancesOverviewHeader
        monthLabel={now.toLocaleString("default", { month: "long", year: "numeric" })}
      />

      <FinancesStatsGrid
        stats={stats}
        statsLoading={statsLoading}
        formatCurrency={formatCurrency}
      />

      <Separator />

      <FinancesQuickActionsGrid activeRecurringCount={stats?.active_recurring_count ?? 0} />

      <Separator />

      <BudgetStatusPanel
        budgetStatus={budgetStatus}
        budgetsLoading={budgetsLoading}
        monthLabel={now.toLocaleString("default", { month: "long" })}
        formatCurrency={formatCurrency}
      />

      <RecentTransactionsPanel
        transactions={transactions}
        accounts={accounts}
        isLoading={isLoading}
        onMarkReviewed={markReviewed}
      />
    </div>
  );
}
