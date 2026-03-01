"use client";

import { useState } from "react";
import { ALL_CATEGORIES, BILLING_CYCLE_LABELS, CATEGORY_LABELS } from "@/types";
import type { BillingCycle, RecurringExpense, TransactionCategory } from "@/types";
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

interface RecurringFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  expense?: RecurringExpense | null;
}

const billingCycles = Object.entries(BILLING_CYCLE_LABELS) as [BillingCycle, string][];

export function RecurringForm({ open, onClose, onSubmit, expense }: RecurringFormProps) {
  const isEdit = !!expense;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: expense?.name ?? "",
    merchant: expense?.merchant ?? "",
    category: (expense?.category ?? "") as TransactionCategory | "",
    expected_amount: expense?.expected_amount?.toString() ?? "",
    billing_cycle: expense?.billing_cycle ?? ("monthly" as BillingCycle),
    next_due_date: expense?.next_due_date ?? "",
    auto_match: expense?.auto_match ?? true,
    notes: expense?.notes ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        merchant: formData.merchant || null,
        category: formData.category || null,
        expected_amount: formData.expected_amount ? parseFloat(formData.expected_amount) : null,
        billing_cycle: formData.billing_cycle,
        next_due_date: formData.next_due_date || null,
        auto_match: formData.auto_match,
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
          <DialogTitle>{isEdit ? "Edit Recurring Expense" : "Add Recurring Expense"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Netflix"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="merchant">Merchant / Match Pattern</Label>
            <Input
              id="merchant"
              value={formData.merchant}
              onChange={(e) => setFormData((p) => ({ ...p, merchant: e.target.value }))}
              placeholder="e.g. NETFLIX"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="billing_cycle">Billing Cycle *</Label>
              <Select
                value={formData.billing_cycle}
                onValueChange={(v) => setFormData((p) => ({ ...p, billing_cycle: v as BillingCycle }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {billingCycles.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expected_amount">Expected Amount</Label>
              <Input
                id="expected_amount"
                type="number"
                step="0.01"
                min="0"
                value={formData.expected_amount}
                onChange={(e) => setFormData((p) => ({ ...p, expected_amount: e.target.value }))}
                placeholder="15.99"
              />
            </div>
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

          <div className="space-y-1.5">
            <Label htmlFor="next_due_date">Next Due Date</Label>
            <Input
              id="next_due_date"
              type="date"
              value={formData.next_due_date}
              onChange={(e) => setFormData((p) => ({ ...p, next_due_date: e.target.value }))}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="auto_match"
              checked={formData.auto_match}
              onChange={(e) => setFormData((p) => ({ ...p, auto_match: e.target.checked }))}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="auto_match" className="cursor-pointer font-normal">
              Auto-link matching transactions by merchant name
            </Label>
          </div>

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
            <Button type="submit" disabled={loading || !formData.name}>
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Recurring"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
