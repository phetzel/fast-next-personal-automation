"use client";

import { StatPill } from "@/components/shared/navigation";
import { Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { formatCurrencyCompact } from "@/lib/formatters";
import type { FinanceStats } from "@/types";
import { AlertCircle, RefreshCw, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { AreaOverviewCardShell } from "./area-overview-card-shell";

interface FinancesAreaCardProps {
  stats: FinanceStats | null;
  loading: boolean;
}

export function FinancesAreaCard({ stats, loading }: FinancesAreaCardProps) {
  const netIsPositive = (stats?.current_month_net ?? 0) >= 0;

  return (
    <AreaOverviewCardShell
      href={ROUTES.FINANCES}
      title="Finances"
      description="Personal financial tracking"
      icon={Wallet}
      tone="emerald"
      stats={
        loading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-14 rounded-lg" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-4 gap-3">
            <StatPill
              icon={TrendingUp}
              label="Income"
              value={formatCurrencyCompact(stats.current_month_income)}
              tone="emerald"
            />
            <StatPill
              icon={TrendingDown}
              label="Expenses"
              value={formatCurrencyCompact(stats.current_month_expenses)}
              tone="red"
            />
            <StatPill
              icon={Wallet}
              label="Net"
              value={formatCurrencyCompact(stats.current_month_net)}
              tone={netIsPositive ? "emerald" : "red"}
              highlight={!netIsPositive}
            />
            <StatPill
              icon={AlertCircle}
              label="Review"
              value={String(stats.unreviewed_count)}
              tone="amber"
              highlight={stats.unreviewed_count > 0}
            />
          </div>
        ) : (
          <div className="py-4 text-center">
            <p className="text-muted-foreground text-sm">No stats available</p>
          </div>
        )
      }
      footer={
        stats ? (
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">
                {stats.current_month_transactions}
              </span>{" "}
              transactions this month
            </span>
            {stats.active_recurring_count > 0 ? (
              <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="font-medium">{stats.active_recurring_count}</span> recurring
              </span>
            ) : null}
          </div>
        ) : null
      }
    />
  );
}
