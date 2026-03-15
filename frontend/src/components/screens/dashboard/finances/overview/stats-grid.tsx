import { MetricCard } from "@/components/shared/navigation";
import type { FinanceStats } from "@/types";
import { AlertCircle, TrendingDown, TrendingUp, Wallet } from "lucide-react";

interface FinancesStatsGridProps {
  stats: FinanceStats | null;
  statsLoading: boolean;
  formatCurrency: (value: number) => string;
}

export function FinancesStatsGrid({ stats, statsLoading, formatCurrency }: FinancesStatsGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        title="Income"
        value={statsLoading ? null : formatCurrency(stats?.current_month_income ?? 0)}
        icon={TrendingUp}
        tone="emerald"
      />
      <MetricCard
        title="Expenses"
        value={statsLoading ? null : formatCurrency(stats?.current_month_expenses ?? 0)}
        icon={TrendingDown}
        tone="red"
      />
      <MetricCard
        title="Net"
        value={statsLoading ? null : formatCurrency(stats?.current_month_net ?? 0)}
        icon={Wallet}
        tone={(stats?.current_month_net ?? 0) >= 0 ? "emerald" : "red"}
      />
      <MetricCard
        title="To Review"
        value={statsLoading ? null : String(stats?.unreviewed_count ?? 0)}
        icon={AlertCircle}
        tone={(stats?.unreviewed_count ?? 0) > 0 ? "amber" : "slate"}
        subtitle={`${stats?.current_month_transactions ?? 0} transactions`}
      />
    </div>
  );
}
