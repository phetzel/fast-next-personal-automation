"use client";

import { cn } from "@/lib/utils";
import { ACCOUNT_TYPE_LABELS } from "@/types";
import type { FinancialAccount } from "@/types";
import { Building2, CreditCard, TrendingUp, Landmark, AlertCircle, MoreHorizontal, Pencil, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AccountCardProps {
  account: FinancialAccount;
  onEdit?: (account: FinancialAccount) => void;
  onDelete?: (account: FinancialAccount) => void;
  onUpdateBalance?: (account: FinancialAccount) => void;
}

const accountTypeIcons = {
  checking: Building2,
  savings: Landmark,
  credit_card: CreditCard,
  investment: TrendingUp,
  loan: AlertCircle,
  other: Building2,
};

const accountTypeColors = {
  checking: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  savings: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  credit_card: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
  investment: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  loan: "bg-red-500/10 text-red-600 dark:text-red-400",
  other: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
};

export function AccountCard({ account, onEdit, onDelete, onUpdateBalance }: AccountCardProps) {
  const Icon = accountTypeIcons[account.account_type] ?? Building2;
  const colorClass = accountTypeColors[account.account_type] ?? accountTypeColors.other;

  const formatBalance = (balance: number | null) => {
    if (balance === null) return "—";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: account.currency || "USD",
    }).format(balance);
  };

  const isNegative = account.current_balance !== null && account.current_balance < 0;

  return (
    <div className="bg-card border-border rounded-xl border p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", colorClass)}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold leading-tight">{account.name}</h3>
            <p className="text-muted-foreground text-sm">
              {ACCOUNT_TYPE_LABELS[account.account_type]}
              {account.institution && ` · ${account.institution}`}
              {account.last_four && ` ···· ${account.last_four}`}
            </p>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onUpdateBalance && (
              <DropdownMenuItem onClick={() => onUpdateBalance(account)}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Update Balance
              </DropdownMenuItem>
            )}
            {onEdit && (
              <DropdownMenuItem onClick={() => onEdit(account)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </DropdownMenuItem>
            )}
            {(onEdit || onUpdateBalance) && onDelete && <DropdownMenuSeparator />}
            {onDelete && (
              <DropdownMenuItem
                onClick={() => onDelete(account)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4">
        <p className="text-muted-foreground text-xs uppercase tracking-wider">Current Balance</p>
        <p
          className={cn(
            "mt-1 text-2xl font-bold tracking-tight",
            isNegative ? "text-destructive" : "text-foreground"
          )}
        >
          {formatBalance(account.current_balance)}
        </p>
        {account.balance_updated_at && (
          <p className="text-muted-foreground mt-1 text-xs">
            Updated {new Date(account.balance_updated_at).toLocaleDateString()}
          </p>
        )}
      </div>

      {!account.is_active && (
        <div className="mt-3 rounded-md bg-amber-500/10 px-2.5 py-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
          Inactive
        </div>
      )}
    </div>
  );
}
