"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import { BudgetProgress, BudgetForm } from "@/components/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plus, PiggyBank, ChevronLeft, ChevronRight } from "lucide-react";
import type { Budget } from "@/types";

export default function BudgetsPage() {
  const {
    budgetStatus,
    budgetsLoading,
    fetchBudgetStatus,
    createBudget,
    updateBudget,
    deleteBudget,
  } = useFinances();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);

  useEffect(() => {
    fetchBudgetStatus(month, year);
  }, [month, year, fetchBudgetStatus]);

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
    const ok = await createBudget(data);
    if (ok) fetchBudgetStatus(month, year);
  };

  const handleEdit = async (data: object) => {
    if (!editBudget) return;
    const ok = await updateBudget(editBudget.id, data);
    if (ok) fetchBudgetStatus(month, year);
  };

  const handleDelete = async (budgetId: string) => {
    if (!confirm("Delete this budget?")) return;
    await deleteBudget(budgetId);
    fetchBudgetStatus(month, year);
  };

  const monthName = new Date(year, month - 1).toLocaleString("default", {
    month: "long",
    year: "numeric",
  });

  const overBudgetCount = budgetStatus.filter((b) => b.is_over_budget).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Budgets</h1>
          <p className="text-muted-foreground">
            {budgetStatus.length} budget{budgetStatus.length !== 1 ? "s" : ""}
            {overBudgetCount > 0 && (
              <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {overBudgetCount} over budget
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Budget
        </Button>
      </div>

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
                <div key={i} className="bg-muted h-28 animate-pulse rounded-lg" />
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
      />
    </div>
  );
}
