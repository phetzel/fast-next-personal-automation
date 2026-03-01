"use client";

import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/types";
import type { BudgetStatus } from "@/types";
import { AlertTriangle, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";

interface BudgetProgressProps {
  status: BudgetStatus;
  onEdit?: (budget: BudgetStatus["budget"]) => void;
  onDelete?: (budgetId: string) => void;
}

export function BudgetProgress({ status, onEdit, onDelete }: BudgetProgressProps) {
  const { budget, spent_amount, remaining, is_over_budget, transactions_count } = status;

  const pct = budget.amount_limit > 0
    ? Math.min((spent_amount / budget.amount_limit) * 100, 100)
    : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  const barColor = is_over_budget
    ? "bg-destructive"
    : pct >= 80
    ? "bg-amber-500"
    : "bg-emerald-500";

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="font-medium text-sm">{CATEGORY_LABELS[budget.category]}</p>
          <p className="text-muted-foreground text-xs">{transactions_count} transactions</p>
        </div>
        <div className="flex items-center gap-1">
          {onEdit && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(budget)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-7 w-7 p-0"
              onClick={() => onDelete(budget.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="bg-muted h-2 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs">
          <span className={cn(is_over_budget ? "text-destructive font-medium" : "text-muted-foreground")}>
            {fmt(spent_amount)} spent
          </span>
          <span className="text-muted-foreground">{fmt(budget.amount_limit)} budget</span>
        </div>
      </div>

      {/* Status */}
      <div className="flex items-center gap-2">
        {is_over_budget ? (
          <span className="flex items-center gap-1 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Over by {fmt(Math.abs(remaining))}
          </span>
        ) : (
          <span
            className={cn(
              "text-xs font-medium",
              pct >= 80 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"
            )}
          >
            {fmt(remaining)} remaining
          </span>
        )}
      </div>
    </div>
  );
}
