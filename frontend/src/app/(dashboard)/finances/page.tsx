"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useFinances } from "@/hooks";
import { TransactionTable } from "@/components/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import {
  Wallet,
  Receipt,
  Building2,
  PiggyBank,
  RefreshCw,
  Bot,
  ArrowRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Workflow,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Finances Overview</h1>
        <p className="text-muted-foreground">
          {now.toLocaleString("default", { month: "long", year: "numeric" })} summary
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Income"
          value={statsLoading ? null : formatCurrency(stats?.current_month_income ?? 0)}
          icon={TrendingUp}
          color="emerald"
        />
        <StatCard
          title="Expenses"
          value={statsLoading ? null : formatCurrency(stats?.current_month_expenses ?? 0)}
          icon={TrendingDown}
          color="red"
        />
        <StatCard
          title="Net"
          value={statsLoading ? null : formatCurrency(stats?.current_month_net ?? 0)}
          icon={Wallet}
          color={(stats?.current_month_net ?? 0) >= 0 ? "emerald" : "red"}
        />
        <StatCard
          title="To Review"
          value={statsLoading ? null : String(stats?.unreviewed_count ?? 0)}
          icon={AlertCircle}
          color={(stats?.unreviewed_count ?? 0) > 0 ? "amber" : "slate"}
          subtitle={`${stats?.current_month_transactions ?? 0} transactions`}
        />
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <QuickLink href={ROUTES.FINANCES_TRANSACTIONS} icon={Receipt} label="Transactions" desc="View & manage all transactions" color="blue" />
        <QuickLink href={ROUTES.FINANCES_ACCOUNTS} icon={Building2} label="Accounts" desc="Manage financial accounts" color="purple" />
        <QuickLink href={ROUTES.FINANCES_BUDGETS} icon={PiggyBank} label="Budgets" desc="Track spending limits" color="green" />
        <QuickLink href={ROUTES.FINANCES_RECURRING} icon={RefreshCw} label="Recurring" desc={`${stats?.active_recurring_count ?? 0} active subscriptions`} color="orange" />
        <QuickLink href={ROUTES.FINANCES_ASSISTANT} icon={Bot} label="Assistant" desc="Ask about your finances" color="violet" />
        <QuickLink href={ROUTES.PIPELINES} icon={Workflow} label="Run Email Sync" desc="Import transactions from email" color="cyan" />
      </div>

      {/* Budget Status */}
      {budgetStatus.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PiggyBank className="h-5 w-5 text-emerald-500" />
              Budget Status — {now.toLocaleString("default", { month: "long" })}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href={ROUTES.FINANCES_BUDGETS}>
                Manage
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {budgetsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-muted h-24 animate-pulse rounded-lg" />
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {budgetStatus.slice(0, 6).map((bs) => {
                  const pct = bs.budget.amount_limit > 0
                    ? Math.min((bs.spent_amount / bs.budget.amount_limit) * 100, 100)
                    : 0;
                  return (
                    <div key={bs.budget.id} className="rounded-lg border p-3 space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium capitalize">{bs.budget.category.replace("_", " ")}</span>
                        <span className={cn("text-xs", bs.is_over_budget ? "text-destructive" : "text-muted-foreground")}>
                          {formatCurrency(bs.spent_amount)} / {formatCurrency(bs.budget.amount_limit)}
                        </span>
                      </div>
                      <div className="bg-muted h-1.5 rounded-full overflow-hidden">
                        <div
                          className={cn("h-full rounded-full transition-all",
                            bs.is_over_budget ? "bg-destructive" : pct >= 80 ? "bg-amber-500" : "bg-emerald-500"
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-blue-500" />
            Recent Transactions
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link href={ROUTES.FINANCES_TRANSACTIONS}>
              View all
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <TransactionTable
            transactions={transactions.slice(0, 10)}
            accounts={accounts}
            isLoading={isLoading}
            onMarkReviewed={markReviewed}
          />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: string | null;
  icon: typeof Wallet;
  color: "emerald" | "red" | "amber" | "slate";
  subtitle?: string;
}) {
  const colors = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    red: "bg-red-500/10 text-red-600 dark:text-red-400",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-muted-foreground text-sm">{title}</p>
            {value === null ? (
              <div className="bg-muted mt-1 h-6 w-20 animate-pulse rounded" />
            ) : (
              <p className="text-xl font-bold">{value}</p>
            )}
            {subtitle && <p className="text-muted-foreground text-xs">{subtitle}</p>}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  desc,
  color,
}: {
  href: string;
  icon: typeof Wallet;
  label: string;
  desc: string;
  color: "blue" | "purple" | "green" | "orange" | "violet" | "cyan";
}) {
  const colors = {
    blue: "bg-blue-500/10 text-blue-600",
    purple: "bg-purple-500/10 text-purple-600",
    green: "bg-green-500/10 text-green-600",
    orange: "bg-orange-500/10 text-orange-600",
    violet: "bg-violet-500/10 text-violet-600",
    cyan: "bg-cyan-500/10 text-cyan-600",
  };
  return (
    <Link href={href} className="block">
      <Card className="hover:ring-primary/20 h-full transition-all hover:shadow-md hover:ring-2">
        <CardContent className="flex items-center gap-4 p-5">
          <div className={cn("rounded-lg p-2.5", colors[color])}>
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold">{label}</h3>
            <p className="text-muted-foreground truncate text-sm">{desc}</p>
          </div>
          <ArrowRight className="text-muted-foreground h-4 w-4 shrink-0" />
        </CardContent>
      </Card>
    </Link>
  );
}
