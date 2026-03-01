"use client";

import { cn } from "@/lib/utils";
import { BILLING_CYCLE_LABELS, CATEGORY_LABELS } from "@/types";
import type { RecurringExpense } from "@/types";
import { CategoryBadge } from "./category-badge";
import { Button } from "@/components/ui";
import { Pencil, Trash2, CalendarClock, CheckCircle2 } from "lucide-react";

interface RecurringExpenseRowProps {
  expense: RecurringExpense;
  onEdit?: (expense: RecurringExpense) => void;
  onDelete?: (id: string) => void;
}

export function RecurringExpenseRow({ expense, onEdit, onDelete }: RecurringExpenseRowProps) {
  const isSeenThisMonth = expense.last_seen_date
    ? (() => {
        const d = new Date(expense.last_seen_date);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })()
    : false;

  const isDueSoon = expense.next_due_date
    ? (() => {
        const due = new Date(expense.next_due_date);
        const now = new Date();
        const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 7;
      })()
    : false;

  const isPastDue = expense.next_due_date
    ? new Date(expense.next_due_date) < new Date()
    : false;

  const formatAmount = (amount: number | null) => {
    if (amount === null) return "—";
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <tr className={cn("group border-b hover:bg-muted/40 transition-colors", !expense.is_active && "opacity-60")}>
      <td className="py-3 pr-4">
        <div>
          <p className="font-medium">{expense.name}</p>
          {expense.merchant && expense.merchant !== expense.name && (
            <p className="text-muted-foreground text-xs">{expense.merchant}</p>
          )}
        </div>
      </td>

      <td className="py-3 pr-4">
        {expense.category ? (
          <CategoryBadge category={expense.category} />
        ) : (
          <span className="text-muted-foreground text-xs">—</span>
        )}
      </td>

      <td className="py-3 pr-4 tabular-nums font-medium">
        {formatAmount(expense.expected_amount)}
      </td>

      <td className="py-3 pr-4 text-muted-foreground text-sm">
        {BILLING_CYCLE_LABELS[expense.billing_cycle]}
      </td>

      <td className="py-3 pr-4">
        <span
          className={cn(
            "text-sm",
            isPastDue && !isSeenThisMonth
              ? "text-destructive font-medium"
              : isDueSoon
              ? "text-amber-600 dark:text-amber-400 font-medium"
              : "text-muted-foreground"
          )}
        >
          {formatDate(expense.next_due_date)}
          {isPastDue && !isSeenThisMonth && " ⚠"}
        </span>
      </td>

      <td className="py-3 pr-4">
        {isSeenThisMonth ? (
          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Seen this month
          </span>
        ) : expense.last_seen_date ? (
          <span className="text-muted-foreground flex items-center gap-1 text-xs">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(expense.last_seen_date)}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">Never</span>
        )}
      </td>

      <td className="py-3 pl-1">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(expense)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-7 w-7 p-0"
              onClick={() => onDelete(expense.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
