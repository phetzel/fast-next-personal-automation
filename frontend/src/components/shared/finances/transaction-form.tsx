"use client";

import { useEffect, useState } from "react";
import type { FinanceCategory, FinancialAccount, Transaction } from "@/types";
import { Button, Input, Label } from "@/components/ui";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TransactionFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  transaction?: Transaction | null;
  accounts?: FinancialAccount[];
  categories?: FinanceCategory[];
}

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  transaction,
  accounts = [],
  categories = [],
}: TransactionFormProps) {
  const isEdit = !!transaction;
  const [loading, setLoading] = useState(false);
  const defaultAccountId =
    accounts.find((account) => account.is_default && account.is_active)?.id ?? "";

  const [formData, setFormData] = useState(() => buildFormData(transaction, defaultAccountId));

  useEffect(() => {
    if (open) {
      setFormData(buildFormData(transaction, defaultAccountId));
    }
  }, [open, transaction, defaultAccountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const rawAmount = parseFloat(formData.amount);
    const amount =
      formData.transaction_type === "debit" ? -Math.abs(rawAmount) : Math.abs(rawAmount);

    try {
      await onSubmit({
        description: formData.description,
        amount,
        transaction_type: formData.transaction_type,
        transaction_date: formData.transaction_date,
        merchant: formData.merchant || null,
        category: formData.category || null,
        account_id: formData.account_id || null,
        notes: formData.notes || null,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Transaction" : "Add Transaction"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
              placeholder="e.g. Grocery run"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.amount}
                onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="type">Type *</Label>
              <Select
                value={formData.transaction_type}
                onValueChange={(v) =>
                  setFormData((p) => ({
                    ...p,
                    transaction_type: v as Transaction["transaction_type"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Expense (money out)</SelectItem>
                  <SelectItem value="credit">Income (money in)</SelectItem>
                  <SelectItem value="transfer">Transfer (label only)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Transfers are not double-entry yet. They currently save as a normal transaction with
                a transfer label.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transaction_date">Date *</Label>
            <Input
              id="transaction_date"
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData((p) => ({ ...p, transaction_date: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merchant">Merchant</Label>
            <Input
              id="merchant"
              value={formData.merchant}
              onChange={(e) => setFormData((p) => ({ ...p, merchant: e.target.value }))}
              placeholder="e.g. Whole Foods"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData((p) => ({ ...p, category: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.slug} value={cat.slug}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="account_id">Account</Label>
              <Select
                value={formData.account_id || "__none__"}
                onValueChange={(v) =>
                  setFormData((p) => ({ ...p, account_id: v === "__none__" ? "" : v }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">No account</SelectItem>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                      {acc.is_default ? " (default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Input
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.description || !formData.amount}>
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Transaction"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildFormData(transaction: Transaction | null | undefined, defaultAccountId: string) {
  const today = new Date().toISOString().split("T")[0];
  return {
    description: transaction?.description ?? "",
    amount: transaction ? String(Math.abs(transaction.amount)) : "",
    transaction_type: transaction?.transaction_type ?? "debit",
    transaction_date: transaction?.transaction_date ?? today,
    merchant: transaction?.merchant ?? "",
    category: transaction?.category ?? "",
    account_id: transaction?.account_id ?? defaultAccountId,
    notes: transaction?.notes ?? "",
  };
}
