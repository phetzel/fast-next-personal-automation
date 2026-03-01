"use client";

import { useEffect, useState } from "react";
import { useFinances } from "@/hooks";
import {
  TransactionTable,
  TransactionFiltersBar,
  TransactionForm,
  CSVImportModal,
} from "@/components/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plus, Upload, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import type { Transaction } from "@/types";

export default function TransactionsPage() {
  const {
    transactions,
    total,
    isLoading,
    filters,
    accounts,
    accountsLoading,
    fetchTransactions,
    fetchAccounts,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    markReviewed,
    importCSV,
    triggerCategorize,
    setFilters,
    resetFilters,
    goToPage,
  } = useFinances();

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchTransactions();
  }, [fetchAccounts, fetchTransactions]);

  const page = filters.page ?? 1;
  const pageSize = filters.page_size ?? 50;
  const totalPages = Math.ceil(total / pageSize);

  const handleCreate = async (data: object) => {
    await createTransaction(data);
    fetchTransactions();
  };

  const handleEdit = async (data: object) => {
    if (!editTx) return;
    await updateTransaction(editTx.id, data as Parameters<typeof updateTransaction>[1]);
  };

  const handleCategorize = async () => {
    setCategorizing(true);
    try {
      await triggerCategorize();
      fetchTransactions();
    } finally {
      setCategorizing(false);
    }
  };

  const handleFilterChange = (newFilters: Parameters<typeof setFilters>[0]) => {
    setFilters(newFilters);
    fetchTransactions(newFilters);
  };

  const handleReset = () => {
    resetFilters();
    fetchTransactions({ page: 1 });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
          <p className="text-muted-foreground">
            {total} total transaction{total !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCategorize}
            disabled={categorizing}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {categorizing ? "Categorizing..." : "AI Categorize"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button size="sm" onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Transaction
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionFiltersBar
            filters={filters}
            accounts={accountsLoading ? [] : accounts}
            onChange={handleFilterChange}
            onReset={handleReset}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-6">
            <TransactionTable
              transactions={transactions}
              accounts={accounts}
              isLoading={isLoading}
              onEdit={(tx) => {
                setEditTx(tx);
                setShowForm(true);
              }}
              onDelete={(id) => {
                deleteTransaction(id);
              }}
              onMarkReviewed={markReviewed}
            />
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="border-t px-6 py-4 flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Page {page} of {totalPages} · {total} total
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    goToPage(page - 1);
                    fetchTransactions({ page: page - 1 });
                  }}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    goToPage(page + 1);
                    fetchTransactions({ page: page + 1 });
                  }}
                  disabled={page >= totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionForm
        open={showForm}
        onClose={() => {
          setShowForm(false);
          setEditTx(null);
        }}
        onSubmit={editTx ? handleEdit : handleCreate}
        transaction={editTx}
        accounts={accounts}
      />

      <CSVImportModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImport={importCSV}
        accounts={accounts}
      />
    </div>
  );
}
