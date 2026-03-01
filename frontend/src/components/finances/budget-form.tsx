"use client";

import { useState } from "react";
import { ALL_CATEGORIES, CATEGORY_LABELS } from "@/types";
import type { Budget, TransactionCategory } from "@/types";
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

interface BudgetFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  budget?: Budget | null;
  defaultMonth?: number;
  defaultYear?: number;
}

export function BudgetForm({
  open,
  onClose,
  onSubmit,
  budget,
  defaultMonth,
  defaultYear,
}: BudgetFormProps) {
  const isEdit = !!budget;
  const now = new Date();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    category: budget?.category ?? ("other" as TransactionCategory),
    month: budget?.month ?? defaultMonth ?? now.getMonth() + 1,
    year: budget?.year ?? defaultYear ?? now.getFullYear(),
    amount_limit: budget?.amount_limit?.toString() ?? "",
    notes: budget?.notes ?? "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        category: formData.category,
        month: Number(formData.month),
        year: Number(formData.year),
        amount_limit: parseFloat(formData.amount_limit),
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
          <DialogTitle>{isEdit ? "Edit Budget" : "Add Budget"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={formData.category}
              onValueChange={(v) => setFormData((p) => ({ ...p, category: v as TransactionCategory }))}
            >
              <SelectTrigger>
                <SelectValue />
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

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="month">Month *</Label>
              <Select
                value={String(formData.month)}
                onValueChange={(v) => setFormData((p) => ({ ...p, month: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {new Date(2000, m - 1).toLocaleString("default", { month: "long" })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Year *</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) => setFormData((p) => ({ ...p, year: Number(e.target.value) }))}
                min={2020}
                max={2100}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="amount_limit">Budget Limit (USD) *</Label>
            <Input
              id="amount_limit"
              type="number"
              step="0.01"
              min="0"
              value={formData.amount_limit}
              onChange={(e) => setFormData((p) => ({ ...p, amount_limit: e.target.value }))}
              placeholder="500.00"
              required
            />
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
            <Button type="submit" disabled={loading || !formData.amount_limit}>
              {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Budget"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
