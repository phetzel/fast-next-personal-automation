"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import { CategoryForm } from "@/components/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plus, Tag, Pencil, Trash2 } from "lucide-react";
import type { FinanceCategory } from "@/types";

function ColorSwatch({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block h-3.5 w-3.5 flex-shrink-0 rounded-full border border-black/10"
      style={{ backgroundColor: color ?? "#94a3b8" }}
    />
  );
}

interface CategoryRowProps {
  category: FinanceCategory;
  onEdit: (cat: FinanceCategory) => void;
  onDelete: (id: string) => void;
}

function CategoryRow({ category, onEdit, onDelete }: CategoryRowProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/40 transition-colors">
      <div className="flex items-center gap-3">
        <ColorSwatch color={category.color} />
        <span className="text-sm font-medium">{category.name}</span>
        <span className="font-mono text-xs text-muted-foreground">{category.slug}</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onEdit(category)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          onClick={() => onDelete(category.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  const {
    categories,
    categoriesLoading,
    fetchCategories,
    createCategory,
    updateCategory,
    deleteCategory,
  } = useFinances();

  const [showForm, setShowForm] = useState(false);
  const [editCategory, setEditCategory] = useState<FinanceCategory | null>(null);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const incomeCategories = categories.filter((c) => c.category_type === "income" && c.is_active);
  const expenseCategories = categories.filter((c) => c.category_type === "expense" && c.is_active);

  const handleCreate = async (data: object) => {
    await createCategory(data);
    fetchCategories();
  };

  const handleEdit = async (data: object) => {
    if (!editCategory) return;
    await updateCategory(editCategory.id, data);
    fetchCategories();
  };

  const handleDelete = async (id: string) => {
    const name = categories.find((c) => c.id === id)?.name;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteCategory(id);
    fetchCategories();
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Categories</h1>
          <p className="text-muted-foreground">
            {categories.filter((c) => c.is_active).length} active categories
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      {categoriesLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-muted h-10 animate-pulse rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Income */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4 text-emerald-500" />
                Income
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {incomeCategories.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {incomeCategories.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No income categories yet.</p>
              ) : (
                <div className="divide-y">
                  {incomeCategories
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                    .map((cat) => (
                      <CategoryRow
                        key={cat.id}
                        category={cat}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Expense */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Tag className="h-4 w-4 text-rose-500" />
                Expenses
                <span className="ml-auto text-sm font-normal text-muted-foreground">
                  {expenseCategories.length}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {expenseCategories.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted-foreground">No expense categories yet.</p>
              ) : (
                <div className="divide-y">
                  {expenseCategories
                    .sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))
                    .map((cat) => (
                      <CategoryRow
                        key={cat.id}
                        category={cat}
                        onEdit={openEdit}
                        onDelete={handleDelete}
                      />
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
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
