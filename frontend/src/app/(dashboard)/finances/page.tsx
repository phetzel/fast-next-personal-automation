"use client";

import {
  BudgetStatusPanel,
  FinancesOverviewHeader,
  FinancesQuickActionsGrid,
  FinancesStatsGrid,
  RecentTransactionsPanel,
  useFinancesOverviewScreen,
} from "@/components/screens/dashboard/finances/overview";
import { Separator } from "@/components/ui";

export default function FinancesOverviewPage() {
  const screen = useFinancesOverviewScreen();

  return (
    <div className="space-y-6">
      <FinancesOverviewHeader monthLabel={screen.monthLabel} />

      <FinancesStatsGrid
        stats={screen.stats}
        statsLoading={screen.statsLoading}
        formatCurrency={screen.formatCurrency}
      />

      <Separator />

      <FinancesQuickActionsGrid activeRecurringCount={screen.stats?.active_recurring_count ?? 0} />

      <Separator />

      <BudgetStatusPanel
        budgetStatus={screen.budgetStatus}
        budgetsLoading={screen.budgetsLoading}
        monthLabel={screen.monthLabel}
        formatCurrency={screen.formatCurrency}
      />

      <RecentTransactionsPanel
        transactions={screen.transactions}
        accounts={screen.accounts}
        isLoading={screen.isLoading}
        onMarkReviewed={screen.markReviewed}
      />
    </div>
  );
}
