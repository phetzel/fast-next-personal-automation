"use client";

import { useState } from "react";
import { useFinances } from "@/hooks";
import { useConfirmDialog } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { BudgetProgress, BudgetForm } from "@/components/shared/finances";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { formatMonthYear } from "@/lib/formatters";
import { Plus, PiggyBank, ChevronLeft, ChevronRight } from "lucide-react";
import type { Budget } from "@/types";

export default function BudgetsPage() {
  const confirmDialog = useConfirmDialog();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { budgetStatus, budgetsLoading, createBudget, updateBudget, deleteBudget, categories } =
    useFinances({
      budgetMonthYear: { month, year },
    });
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);

  const handlePrev = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const handleCreate = async (data: object) => {
    await createBudget(data);
  };

  const handleEdit = async (data: object) => {
    if (!editBudget) return;
    await updateBudget(editBudget.id, data);
  };

  const handleDelete = async (budgetId: string) => {
    const confirmed = await confirmDialog({
      title: "Delete budget?",
      description: "This will permanently remove the selected budget.",
      confirmLabel: "Delete budget",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteBudget(budgetId);
  };

  const monthName = formatMonthYear(new Date(year, month - 1, 1));

  const overBudgetCount = budgetStatus.filter((b) => b.is_over_budget).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budgets"
        description={
          <>
            {budgetStatus.length} budget{budgetStatus.length !== 1 ? "s" : ""}
            {overBudgetCount > 0 && (
              <span className="bg-destructive/10 text-destructive ml-2 rounded-full px-2 py-0.5 text-xs font-medium">
                {overBudgetCount} over budget
              </span>
            )}
          </>
        }
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Budget
          </Button>
        }
      />

      {/* Month selector */}
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <Button variant="ghost" size="sm" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <p className="font-semibold">{monthName}</p>
          <Button variant="ghost" size="sm" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </CardContent>
      </Card>

      {/* Budget grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PiggyBank className="h-5 w-5 text-emerald-500" />
            {monthName} Budget vs. Actuals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {budgetsLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : budgetStatus.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center">
              <PiggyBank className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
              <p className="font-medium">No budgets for {monthName}</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Set spending limits to track your expenses
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Budget
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {budgetStatus.map((bs) => (
                <BudgetProgress
                  key={bs.budget.id}
                  status={bs}
                  onEdit={(b) => {
                    setEditBudget(b);
                    setShowForm(true);
                  }}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <BudgetForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditBudget(null);
        }}
        onSubmit={editBudget ? handleEdit : handleCreate}
        budget={editBudget}
        defaultMonth={month}
        defaultYear={year}
        categories={categories}
      />
    </div>
  );
}
