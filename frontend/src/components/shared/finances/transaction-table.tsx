"use client";

import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/formatters";
import type { Transaction, FinancialAccount } from "@/types";
import { CategoryBadge } from "./category-badge";
import {
  Button,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
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

  if (isLoading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-lg" />
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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Account</TableHead>
          <TableHead className="text-right">Amount</TableHead>
          <TableHead className="text-center">Source</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {transactions.map((tx) => {
          const formattedAmount = formatCurrency(Math.abs(tx.amount));
          const isPositive = tx.amount >= 0;
          const SourceIcon = sourceIcon[tx.source] ?? PenLine;
          const account = tx.account_id ? accountMap[tx.account_id] : null;

          return (
            <TableRow
              key={tx.id}
              className={cn(
                "group hover:bg-muted/40",
                !tx.is_reviewed && "bg-amber-50/30 dark:bg-amber-500/5"
              )}
            >
              <TableCell className="whitespace-nowrap">
                {formatDate(`${tx.transaction_date}T00:00:00`, "MMM d")}
              </TableCell>
              <TableCell className="max-w-[240px]">
                <p className="truncate font-medium">{tx.description}</p>
                {tx.merchant && tx.merchant !== tx.description ? (
                  <p className="text-muted-foreground truncate text-xs">{tx.merchant}</p>
                ) : null}
              </TableCell>
              <TableCell>
                <CategoryBadge category={tx.category} />
              </TableCell>
              <TableCell className="text-muted-foreground">{account?.name ?? "—"}</TableCell>
              <TableCell
                className={cn(
                  "text-right font-semibold tabular-nums",
                  isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
                )}
              >
                {isPositive ? "+" : ""}
                {formattedAmount}
              </TableCell>
              <TableCell className="text-center">
                <span
                  className="text-muted-foreground inline-flex items-center gap-1 text-xs"
                  title={sourceLabel[tx.source]}
                >
                  <SourceIcon className="h-3.5 w-3.5" />
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  {onMarkReviewed ? (
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
                  ) : null}
                  {onEdit ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => onEdit(tx)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {onDelete ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive h-7 w-7 p-0"
                      onClick={() => onDelete(tx.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
