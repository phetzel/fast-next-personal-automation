"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui";
import { useFinances } from "@/hooks";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  Wallet,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  RefreshCw,
  ArrowRight,
} from "lucide-react";

/**
 * Finances area card for the main dashboard.
 * Shows key financial stats for the current month.
 */
export function FinancesAreaCard() {
  const { stats, statsLoading, fetchStats } = useFinances();

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const netIsPositive = (stats?.current_month_net ?? 0) >= 0;

  return (
    <Link href={ROUTES.FINANCES} className="group block">
      <Card
        className={cn(
          "relative overflow-hidden transition-all duration-300",
          "hover:ring-primary/20 hover:shadow-lg hover:ring-2",
          "hover:-translate-y-0.5"
        )}
      >
        {/* Decorative gradient background */}
        <div
          className={cn(
            "absolute inset-0 opacity-0 transition-opacity duration-300",
            "bg-gradient-to-br from-emerald-500/5 via-transparent to-teal-500/5",
            "group-hover:opacity-100"
          )}
        />

        <CardContent className="relative p-6">
          {/* Header */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "rounded-xl p-3 transition-colors",
                  "bg-emerald-500/10 text-emerald-600",
                  "dark:bg-emerald-500/20 dark:text-emerald-400"
                )}
              >
                <Wallet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Finances</h3>
                <p className="text-muted-foreground text-sm">Personal financial tracking</p>
              </div>
            </div>
            <ArrowRight
              className={cn(
                "text-muted-foreground h-5 w-5 transition-transform",
                "group-hover:text-primary group-hover:translate-x-1"
              )}
            />
          </div>

          {/* Stats Grid */}
          {statsLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-muted h-14 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : stats ? (
            <div className="grid grid-cols-4 gap-3">
              <StatPill
                icon={TrendingUp}
                label="Income"
                value={fmtShort(stats.current_month_income)}
                color="emerald"
              />
              <StatPill
                icon={TrendingDown}
                label="Expenses"
                value={fmtShort(stats.current_month_expenses)}
                color="red"
              />
              <StatPill
                icon={Wallet}
                label="Net"
                value={fmtShort(stats.current_month_net)}
                color={netIsPositive ? "emerald" : "red"}
                highlight={!netIsPositive}
              />
              <StatPill
                icon={AlertCircle}
                label="Review"
                value={String(stats.unreviewed_count)}
                color="amber"
                highlight={stats.unreviewed_count > 0}
              />
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-muted-foreground text-sm">No stats available</p>
            </div>
          )}

          {/* Footer Summary */}
          {stats && (
            <div className="border-border/50 mt-4 flex items-center justify-between border-t pt-4 text-sm">
              <span className="text-muted-foreground">
                <span className="text-foreground font-medium">{stats.current_month_transactions}</span>{" "}
                transactions this month
              </span>
              {stats.active_recurring_count > 0 && (
                <span className="flex items-center gap-1 text-orange-600 dark:text-orange-400">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span className="font-medium">{stats.active_recurring_count}</span> recurring
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}

function fmtShort(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return `$${(abs / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(abs);
}

interface StatPillProps {
  icon: typeof Wallet;
  label: string;
  value: string;
  color: "emerald" | "red" | "amber" | "blue";
  highlight?: boolean;
}

const colorStyles = {
  emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

function StatPill({ icon: Icon, label, value, color, highlight }: StatPillProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg px-1 py-2 transition-colors",
        colorStyles[color],
        highlight && "ring-1 ring-current/20"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="text-sm leading-none font-bold">{value}</span>
      <span className="text-[10px] tracking-wider uppercase opacity-80">{label}</span>
    </div>
  );
}
