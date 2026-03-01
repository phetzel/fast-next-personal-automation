"use client";

import { useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/types";
import type { FinancialAccount, Transaction, TransactionCategory } from "@/types";
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
}

export function TransactionForm({
  open,
  onClose,
  onSubmit,
  transaction,
  accounts = [],
}: TransactionFormProps) {
  const isEdit = !!transaction;
  const [loading, setLoading] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [formData, setFormData] = useState({
    description: transaction?.description ?? "",
    amount: transaction ? String(Math.abs(transaction.amount)) : "",
    transaction_type: transaction?.transaction_type ?? "debit",
    transaction_date: transaction?.transaction_date ?? today,
    merchant: transaction?.merchant ?? "",
    category: (transaction?.category ?? "") as TransactionCategory | "",
    account_id: transaction?.account_id ?? "",
    notes: transaction?.notes ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const rawAmount = parseFloat(formData.amount);
    const amount = formData.transaction_type === "debit" ? -Math.abs(rawAmount) : Math.abs(rawAmount);

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
      <DialogContent className="sm:max-w-md">
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
                onValueChange={(v) => setFormData((p) => ({ ...p, transaction_type: v as Transaction["transaction_type"] }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">Expense (Debit)</SelectItem>
                  <SelectItem value="credit">Income (Credit)</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
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
              onValueChange={(v) => setFormData((p) => ({ ...p, category: v as TransactionCategory }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select category..." />
              </SelectTrigger>
              <SelectContent>
                {ALL_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_LABELS[cat]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="account_id">Account</Label>
              <Select
                value={formData.account_id}
                onValueChange={(v) => setFormData((p) => ({ ...p, account_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select account..." />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
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
