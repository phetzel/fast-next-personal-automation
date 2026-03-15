"use client";

import { useState } from "react";
import { FormDialogShell } from "@/components/shared/forms";
import type { FinanceCategory } from "@/types";
import { Button, Input, Label } from "@/components/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CategoryFormProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: object) => Promise<void>;
  category?: FinanceCategory | null;
}

export function CategoryForm({ open, onClose, onSubmit, category }: CategoryFormProps) {
  const isEdit = !!category;
  const formId = isEdit ? "edit-category-form" : "create-category-form";
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: category?.name ?? "",
    category_type: category?.category_type ?? ("expense" as "income" | "expense"),
    color: category?.color ?? "#94a3b8",
    sort_order: category?.sort_order?.toString() ?? "0",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit({
        name: formData.name,
        // category_type is only sent on create (backend update schema doesn't include it)
        ...(!isEdit && { category_type: formData.category_type }),
        color: formData.color || null,
        sort_order: parseInt(formData.sort_order) || 0,
      });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onClose();
        }
      }}
      title={isEdit ? "Edit Category" : "Add Category"}
      maxWidth="sm:max-w-sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" form={formId} disabled={loading || !formData.name}>
            {loading ? "Saving..." : isEdit ? "Save Changes" : "Add Category"}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
            placeholder="e.g. Dining Out"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="category_type">Type {!isEdit && "*"}</Label>
          <Select
            value={formData.category_type}
            onValueChange={(v) =>
              setFormData((p) => ({ ...p, category_type: v as "income" | "expense" }))
            }
            disabled={isEdit}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="expense">Expense</SelectItem>
              <SelectItem value="income">Income</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="color">Color</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="color"
              value={formData.color}
              onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
              className="h-9 w-12 cursor-pointer rounded border p-1"
            />
            <Input
              value={formData.color}
              onChange={(e) => setFormData((p) => ({ ...p, color: e.target.value }))}
              placeholder="#94a3b8"
              className="font-mono text-sm"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="sort_order">Sort Order</Label>
          <Input
            id="sort_order"
            type="number"
            min="0"
            value={formData.sort_order}
            onChange={(e) => setFormData((p) => ({ ...p, sort_order: e.target.value }))}
            placeholder="0"
          />
        </div>
      </form>
    </FormDialogShell>
  );
}
