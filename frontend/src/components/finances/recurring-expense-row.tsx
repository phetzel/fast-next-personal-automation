"use client";

import { cn } from "@/lib/utils";
import { BILLING_CYCLE_LABELS } from "@/types";
import type { FinancialAccount, RecurringExpense } from "@/types";
import { CategoryBadge } from "./category-badge";
import { Button } from "@/components/ui";
import { Pencil, Trash2, CalendarClock, CheckCircle2, Landmark } from "lucide-react";

interface RecurringExpenseRowProps {
  expense: RecurringExpense;
  accounts?: FinancialAccount[];
  onEdit?: (expense: RecurringExpense) => void;
  onDelete?: (id: string) => void;
}

export function RecurringExpenseRow({
  expense,
  accounts = [],
  onEdit,
  onDelete,
}: RecurringExpenseRowProps) {
  const linkedAccount = expense.account_id
    ? accounts.find((a) => a.id === expense.account_id)
    : null;
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

  const isPastDue = expense.next_due_date ? new Date(expense.next_due_date) < new Date() : false;

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
    <tr
      className={cn(
        "hover:bg-muted/40 border-b transition-colors",
        !expense.is_active && "opacity-60"
      )}
    >
      {/* Name */}
      <td className="py-3 pr-4 pl-6">
        <p className="font-medium">{expense.name}</p>
        {expense.merchant && expense.merchant !== expense.name && (
          <p className="text-muted-foreground mt-0.5 text-xs">{expense.merchant}</p>
        )}
      </td>

      {/* Account */}
      <td className="py-3 pr-4">
        {linkedAccount ? (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <Landmark className="h-3.5 w-3.5 flex-shrink-0" />
            {linkedAccount.name}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>

      {/* Category */}
      <td className="py-3 pr-4">
        {expense.category ? (
          <CategoryBadge category={expense.category} />
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        )}
      </td>

      {/* Amount */}
      <td className="py-3 pr-4 text-right font-medium tabular-nums">
        {formatAmount(expense.expected_amount)}
      </td>

      {/* Cycle */}
      <td className="text-muted-foreground py-3 pr-4 text-sm">
        {BILLING_CYCLE_LABELS[expense.billing_cycle]}
      </td>

      {/* Next Due */}
      <td className="py-3 pr-4">
        <span
          className={cn(
            "text-sm",
            isPastDue && !isSeenThisMonth
              ? "text-destructive font-medium"
              : isDueSoon
                ? "font-medium text-amber-600 dark:text-amber-400"
                : "text-muted-foreground"
          )}
        >
          {formatDate(expense.next_due_date)}
          {isPastDue && !isSeenThisMonth && " ⚠"}
        </span>
      </td>

      {/* Last Seen */}
      <td className="py-3 pr-4">
        {isSeenThisMonth ? (
          <span className="flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Seen this month
          </span>
        ) : expense.last_seen_date ? (
          <span className="text-muted-foreground flex items-center gap-1 text-sm">
            <CalendarClock className="h-3.5 w-3.5" />
            {formatDate(expense.last_seen_date)}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Never</span>
        )}
      </td>

      {/* Actions — always visible */}
      <td className="py-3 pr-6">
        <div className="flex items-center justify-end gap-1">
          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEdit(expense)}
              aria-label="Edit recurring expense"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive h-7 w-7 p-0"
              onClick={() => onDelete(expense.id)}
              aria-label="Delete recurring expense"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </td>
    </tr>
  );
}
