"use client";

import { cn } from "@/lib/utils";
import type { Transaction, FinancialAccount } from "@/types";
import { CategoryBadge } from "./category-badge";
import { Button } from "@/components/ui";
import { CheckCircle2, Circle, Pencil, Trash2, Mail, FileText, PenLine } from "lucide-react";

interface TransactionTableProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  isLoading?: boolean;
  onEdit?: (tx: Transaction) => void;
  onDelete?: (txId: string) => void;
  onMarkReviewed?: (txId: string) => void;
}

const sourceIcon = {
  manual: PenLine,
  csv_import: FileText,
  email_parsed: Mail,
};

const sourceLabel = {
  manual: "Manual",
  csv_import: "CSV",
  email_parsed: "Email",
};

export function TransactionTable({
  transactions,
  accounts,
  isLoading,
  onEdit,
  onDelete,
  onMarkReviewed,
}: TransactionTableProps) {
  const accountMap = Object.fromEntries(accounts.map((a) => [a.id, a]));

  const formatAmount = (amount: number) => {
    const abs = Math.abs(amount);
    const formatted = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(abs);
    return { formatted, isPositive: amount >= 0 };
  };

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-muted-foreground">No transactions found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Try adjusting your filters or add a transaction
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-muted-foreground pb-2 text-left font-medium">Date</th>
            <th className="text-muted-foreground pb-2 text-left font-medium">Description</th>
            <th className="text-muted-foreground pb-2 text-left font-medium">Category</th>
            <th className="text-muted-foreground pb-2 text-left font-medium">Account</th>
            <th className="text-muted-foreground pb-2 text-right font-medium">Amount</th>
            <th className="text-muted-foreground pb-2 text-center font-medium">Source</th>
            <th className="pb-2" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {transactions.map((tx) => {
            const { formatted, isPositive } = formatAmount(tx.amount);
            const SourceIcon = sourceIcon[tx.source] ?? PenLine;
            const account = tx.account_id ? accountMap[tx.account_id] : null;

            return (
              <tr key={tx.id} className={cn("group hover:bg-muted/40 transition-colors", !tx.is_reviewed && "bg-amber-50/30 dark:bg-amber-500/5")}>
                <td className="py-2.5 pr-4 whitespace-nowrap">
                  {new Date(tx.transaction_date + "T00:00:00").toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </td>
                <td className="py-2.5 pr-4 max-w-[240px]">
                  <p className="truncate font-medium">{tx.description}</p>
                  {tx.merchant && tx.merchant !== tx.description && (
                    <p className="text-muted-foreground truncate text-xs">{tx.merchant}</p>
                  )}
                </td>
                <td className="py-2.5 pr-4">
                  <CategoryBadge category={tx.category} />
                </td>
                <td className="py-2.5 pr-4 text-muted-foreground">
                  {account?.name ?? "—"}
                </td>
                <td
                  className={cn(
                    "py-2.5 pr-2 text-right font-semibold tabular-nums whitespace-nowrap",
                    isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                  )}
                >
                  {isPositive ? "+" : ""}{formatted}
                </td>
                <td className="py-2.5 px-2 text-center">
                  <span
                    className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                    title={sourceLabel[tx.source]}
                  >
                    <SourceIcon className="h-3.5 w-3.5" />
                  </span>
                </td>
                <td className="py-2.5 pl-1">
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {onMarkReviewed && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-7 w-7 p-0",
                          tx.is_reviewed
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-muted-foreground"
                        )}
                        title={tx.is_reviewed ? "Mark unreviewed" : "Mark reviewed"}
                        onClick={() => onMarkReviewed(tx.id)}
                      >
                        {tx.is_reviewed ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <Circle className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    {onEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => onEdit(tx)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive h-7 w-7 p-0"
                        onClick={() => onDelete(tx.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
