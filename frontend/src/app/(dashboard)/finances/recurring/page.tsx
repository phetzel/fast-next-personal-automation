"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import { useConfirmDialog } from "@/components/shared/feedback";
import { RecurringExpenseRow, RecurringForm } from "@/components/shared/finances";
import { PageHeader } from "@/components/shared/layout";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Skeleton,
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { Plus, RefreshCw } from "lucide-react";
import type { RecurringExpense } from "@/types";

export default function RecurringPage() {
  const confirmDialog = useConfirmDialog();
  const {
    recurringExpenses,
    recurringLoading,
    fetchRecurring,
    createRecurring,
    updateRecurring,
    deleteRecurring,
    categories,
    fetchCategories,
    accounts,
    fetchAccounts,
  } = useFinances();

  const [showForm, setShowForm] = useState(false);
  const [editExpense, setEditExpense] = useState<RecurringExpense | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    fetchRecurring(false); // fetch all including inactive
    fetchCategories();
    fetchAccounts();
  }, [fetchRecurring, fetchCategories, fetchAccounts]);

  const displayed = showInactive ? recurringExpenses : recurringExpenses.filter((e) => e.is_active);

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
    const confirmed = await confirmDialog({
      title: `Delete "${name}"?`,
      description: "This cannot be undone.",
      confirmLabel: "Delete recurring item",
      destructive: true,
    });
    if (!confirmed) return;
    await deleteRecurring(id);
  };

  const totalMonthly = recurringExpenses
    .filter((e) => e.is_active && e.expected_amount !== null)
    .reduce((sum, e) => {
      const amount = e.expected_amount ?? 0;
      switch (e.billing_cycle) {
        case "weekly":
          return sum + amount * 4.33;
        case "biweekly":
          return sum + amount * 2.17;
        case "monthly":
          return sum + amount;
        case "quarterly":
          return sum + amount / 3;
        case "annual":
          return sum + amount / 12;
        default:
          return sum + amount;
      }
    }, 0);

  const fmt = (n: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring Expenses"
        description={`${recurringExpenses.filter((e) => e.is_active).length} active · ~${fmt(totalMonthly)}/mo estimated`}
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Recurring
          </Button>
        }
      />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-orange-500" />
            Subscriptions & Bills
          </CardTitle>
          {inactiveCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowInactive((v) => !v)}>
              {showInactive ? "Hide" : "Show"} {inactiveCount} inactive
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {recurringLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))}
            </div>
          ) : displayed.length === 0 ? (
            <div className="mx-6 mb-6 rounded-xl border border-dashed py-12 text-center">
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[20%] pr-4 pl-6">Name</TableHead>
                  <TableHead className="pr-4">Account</TableHead>
                  <TableHead className="pr-4">Category</TableHead>
                  <TableHead className="pr-4 text-right">Amount</TableHead>
                  <TableHead className="pr-4">Cycle</TableHead>
                  <TableHead className="pr-4">Next Due</TableHead>
                  <TableHead className="pr-4">Last Seen</TableHead>
                  <TableHead className="pr-6 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayed.map((expense) => (
                  <RecurringExpenseRow
                    key={expense.id}
                    expense={expense}
                    accounts={accounts}
                    onEdit={(e) => {
                      setEditExpense(e);
                      setShowForm(true);
                    }}
                    onDelete={handleDelete}
                  />
                ))}
              </TableBody>
            </Table>
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
        categories={categories}
        accounts={accounts}
      />
    </div>
  );
}
