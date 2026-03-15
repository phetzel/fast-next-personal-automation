"use client";

import { useState } from "react";
import { useFinances } from "@/hooks";
import { useConfirmDialog } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { CategoryForm } from "@/components/shared/finances";
import { CategorySectionCard } from "@/components/screens/dashboard/finances/categories";
import { Button, Skeleton } from "@/components/ui";
import { Plus, Tag } from "lucide-react";
import type { FinanceCategory } from "@/types";

export default function CategoriesPage() {
  const confirmDialog = useConfirmDialog();
  const { categories, categoriesLoading, createCategory, updateCategory, deleteCategory } =
    useFinances();

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<FinanceCategory | null>(null);

  const incomeCategories = categories.filter((c) => c.category_type === "income" && c.is_active);
  const expenseCategories = categories.filter((c) => c.category_type === "expense" && c.is_active);

  const handleCreate = async (data: object) => {
    await createCategory(data);
  };

  const handleEdit = async (data: object) => {
    if (!editCategory) return;
    await updateCategory(editCategory.id, data);
  };

  const handleDelete = async (id: string) => {
    const name = categories.find((c) => c.id === id)?.name;
    const confirmed = await confirmDialog({
      title: `Delete "${name}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete category",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteCategory(id);
  };

  const openEdit = (cat: FinanceCategory) => {
    setEditCategory(cat);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditCategory(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Categories"
        description={`${categories.filter((c) => c.is_active).length} active categories`}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        }
      />

      {categoriesLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          <CategorySectionCard
            title="Income"
            icon={Tag}
            iconClassName="h-4 w-4 text-emerald-500"
            emptyText="No income categories yet."
            categories={incomeCategories.sort(
              (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
            )}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
          <CategorySectionCard
            title="Expenses"
            icon={Tag}
            iconClassName="h-4 w-4 text-rose-500"
            emptyText="No expense categories yet."
            categories={expenseCategories.sort(
              (a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name)
            )}
            onEdit={openEdit}
            onDelete={handleDelete}
          />
        </div>
      )}

      <CategoryForm
        open={showForm}
        onClose={closeForm}
        onSubmit={editCategory ? handleEdit : handleCreate}
        category={editCategory}
      />
    </div>
  );
}
