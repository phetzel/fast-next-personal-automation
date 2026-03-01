"use client";

import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/types";
import type { FinancialAccount, TransactionFilters } from "@/types";
import { Button, Input } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X } from "lucide-react";

interface TransactionFiltersProps {
  filters: TransactionFilters;
  accounts: FinancialAccount[];
  onChange: (filters: Partial<TransactionFilters>) => void;
  onReset: () => void;
}

export function TransactionFiltersBar({ filters, accounts, onChange, onReset }: TransactionFiltersProps) {
  const hasActiveFilters =
    filters.category ||
    filters.account_id ||
    filters.source ||
    filters.transaction_type ||
    filters.date_from ||
    filters.date_to ||
    filters.search ||
    filters.is_reviewed !== undefined;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {/* Search */}
        <Input
          placeholder="Search description..."
          value={filters.search ?? ""}
          onChange={(e) => onChange({ search: e.target.value || undefined, page: 1 })}
          className="h-9 w-48"
        />

        {/* Category */}
        <Select
          value={filters.category ?? "all"}
          onValueChange={(v) => onChange({ category: v === "all" ? undefined : (v as TransactionFilters["category"]), page: 1 })}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {ALL_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {CATEGORY_LABELS[cat]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Account */}
        {accounts.length > 0 && (
          <Select
            value={filters.account_id ?? "all"}
            onValueChange={(v) => onChange({ account_id: v === "all" ? undefined : v, page: 1 })}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Transaction type */}
        <Select
          value={filters.transaction_type ?? "all"}
          onValueChange={(v) =>
            onChange({ transaction_type: v === "all" ? undefined : (v as TransactionFilters["transaction_type"]), page: 1 })
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="debit">Expense</SelectItem>
            <SelectItem value="credit">Income</SelectItem>
            <SelectItem value="transfer">Transfer</SelectItem>
          </SelectContent>
        </Select>

        {/* Source */}
        <Select
          value={filters.source ?? "all"}
          onValueChange={(v) =>
            onChange({ source: v === "all" ? undefined : (v as TransactionFilters["source"]), page: 1 })
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="manual">Manual</SelectItem>
            <SelectItem value="csv_import">CSV Import</SelectItem>
            <SelectItem value="email_parsed">Email</SelectItem>
          </SelectContent>
        </Select>

        {/* Date range */}
        <Input
          type="date"
          value={filters.date_from ?? ""}
          onChange={(e) => onChange({ date_from: e.target.value || undefined, page: 1 })}
          className="h-9 w-36"
          placeholder="From date"
        />
        <Input
          type="date"
          value={filters.date_to ?? ""}
          onChange={(e) => onChange({ date_to: e.target.value || undefined, page: 1 })}
          className="h-9 w-36"
          placeholder="To date"
        />

        {/* Reviewed filter */}
        <Select
          value={filters.is_reviewed === undefined ? "all" : String(filters.is_reviewed)}
          onValueChange={(v) =>
            onChange({ is_reviewed: v === "all" ? undefined : v === "true", page: 1 })
          }
        >
          <SelectTrigger className="h-9 w-36">
            <SelectValue placeholder="All Reviews" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Reviews</SelectItem>
            <SelectItem value="false">Unreviewed</SelectItem>
            <SelectItem value="true">Reviewed</SelectItem>
          </SelectContent>
        </Select>

        {/* Reset */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={onReset}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}
