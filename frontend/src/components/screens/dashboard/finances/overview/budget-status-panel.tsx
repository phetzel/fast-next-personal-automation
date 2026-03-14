import Link from "next/link";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { BudgetStatus } from "@/types";
import { ArrowRight, PiggyBank } from "lucide-react";

interface BudgetStatusPanelProps {
  budgetStatus: BudgetStatus[];
  budgetsLoading: boolean;
  monthLabel: string;
  formatCurrency: (value: number) => string;
}

export function BudgetStatusPanel({
  budgetStatus,
  budgetsLoading,
  monthLabel,
  formatCurrency,
}: BudgetStatusPanelProps) {
  if (budgetStatus.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <PiggyBank className="h-5 w-5 text-emerald-500" />
          Budget Status - {monthLabel}
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
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-lg" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {budgetStatus.slice(0, 6).map((status) => {
              const pct =
                status.budget.amount_limit > 0
                  ? Math.min((status.spent_amount / status.budget.amount_limit) * 100, 100)
                  : 0;

              return (
                <div key={status.budget.id} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium capitalize">
                      {(status.budget.category ?? "General").replace("_", " ")}
                    </span>
                    <span
                      className={cn(
                        "text-xs",
                        status.is_over_budget ? "text-destructive" : "text-muted-foreground"
                      )}
                    >
                      {formatCurrency(status.spent_amount)} /{" "}
                      {formatCurrency(status.budget.amount_limit)}
                    </span>
                  </div>
                  <div className="bg-muted h-1.5 overflow-hidden rounded-full">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        status.is_over_budget
                          ? "bg-destructive"
                          : pct >= 80
                            ? "bg-amber-500"
                            : "bg-emerald-500"
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
  );
}
