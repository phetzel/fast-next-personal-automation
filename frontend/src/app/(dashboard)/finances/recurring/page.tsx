"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import { RecurringExpenseRow, RecurringForm } from "@/components/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plus, RefreshCw } from "lucide-react";
import type { RecurringExpense } from "@/types";

export default function RecurringPage() {
  const {
    recurringExpenses,
    recurringLoading,
    fetchRecurring,
    createRecurring,
    updateRecurring,
    deleteRecurring,
  } = useFinances();

  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState<RecurringExpense | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchRecurring(false); // fetch all including inactive
  }, [fetchRecurring]);

  const displayed = showInactive
    ? recurringExpenses
    : recurringExpenses.filter((e) => e.is_active);

  const inactiveCount = recurringExpenses.filter((e) => !e.is_active).length;

  const handleCreate = async (data: object) => {
    await createRecurring(data);
  };

  const handleEdit = async (data: object) => {
    if (!editExpense) return;
    await updateRecurring(editExpense.id, data);
  };

  const handleDelete = async (id: string) => {
    const name = recurringExpenses.find((e) => e.id === id)?.name;
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    await deleteRecurring(id);
  };

  const totalMonthly = recurringExpenses
    .filter((e) => e.is_active && e.expected_amount !== null)
    .reduce((sum, e) => {
      const amount = e.expected_amount ?? 0;
      switch (e.billing_cycle) {
        case "weekly": return sum + amount * 4.33;
        case "biweekly": return sum + amount * 2.17;
        case "monthly": return sum + amount;
        case "quarterly": return sum + amount / 3;
        case "annual": return sum + amount / 12;
        default: return sum + amount;
      }
    }, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Recurring Expenses</h1>
          <p className="text-muted-foreground">
            {recurringExpenses.filter((e) => e.is_active).length} active ·{" "}
            ~{fmt(totalMonthly)}/mo estimated
          </p>
        </div>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Recurring
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            Subscriptions & Bills
          </CardTitle>
          {inactiveCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowInactive((v) => !v)}
            >
              {showInactive ? "Hide" : "Show"} {inactiveCount} inactive
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {recurringLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-muted h-12 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center mx-6 mb-6">
              <RefreshCw className="text-muted-foreground mx-auto mb-3 h-10 w-10" />
              <p className="font-medium">No recurring expenses yet</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Track subscriptions, rent, utilities and more
              </p>
              <Button className="mt-4" onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Recurring
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-muted-foreground px-6 pb-3 pt-0 text-left font-medium">Name</th>
                    <th className="text-muted-foreground pb-3 pr-4 text-left font-medium">Category</th>
                    <th className="text-muted-foreground pb-3 pr-4 text-right font-medium">Amount</th>
                    <th className="text-muted-foreground pb-3 pr-4 text-left font-medium">Cycle</th>
                    <th className="text-muted-foreground pb-3 pr-4 text-left font-medium">Next Due</th>
                    <th className="text-muted-foreground pb-3 pr-4 text-left font-medium">Last Seen</th>
                    <th className="pb-3" />
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((expense) => (
                    <RecurringExpenseRow
                      key={expense.id}
                      expense={expense}
                      onEdit={(e) => {
                        setEditExpense(e);
                        setShowForm(true);
                      }}
                      onDelete={handleDelete}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <RecurringForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditExpense(null);
        }}
        onSubmit={editExpense ? handleEdit : handleCreate}
        expense={editExpense}
      />
    </div>
  );
}
