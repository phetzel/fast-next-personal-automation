"use client";

import { PaginationControls } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { useTransactionsScreen } from "@/components/screens/dashboard/finances/transactions";
import {
  TransactionTable,
  TransactionFiltersBar,
  TransactionForm,
  CSVImportModal,
} from "@/components/shared/finances";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { Plus, Upload, Sparkles } from "lucide-react";

export default function TransactionsPage() {
  const screen = useTransactionsScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description={`${screen.total} total transaction${screen.total !== 1 ? "s" : ""}`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={screen.handleCategorize}
              disabled={screen.categorizing}
            >
              <Sparkles className="mr-2 h-4 w-4" />
              {screen.categorizing ? "Categorizing..." : "AI Categorize"}
            </Button>
            <Button variant="outline" size="sm" onClick={() => screen.setShowImport(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import CSV
            </Button>
            <Button size="sm" onClick={() => screen.setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Button>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <TransactionFiltersBar
            filters={screen.filters}
            accounts={screen.accountsLoading ? [] : screen.accounts}
            categories={screen.categories}
            onChange={screen.handleFilterChange}
            onReset={screen.handleReset}
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="p-6">
            <TransactionTable
              transactions={screen.transactions}
              accounts={screen.accounts}
              isLoading={screen.isLoading}
              onEdit={(tx) => {
                screen.setEditTx(tx);
                screen.setShowForm(true);
              }}
              onDelete={screen.handleDelete}
              onMarkReviewed={screen.markReviewed}
            />
          </div>

          <div className="px-6 pb-4">
            <PaginationControls
              page={screen.page}
              totalPages={screen.totalPages}
              summary={`Page ${screen.page} of ${screen.totalPages} · ${screen.total} total`}
              onPrevious={() => screen.handlePageChange(screen.page - 1)}
              onNext={() => screen.handlePageChange(screen.page + 1)}
            />
          </div>
        </CardContent>
      </Card>

      <TransactionForm
        open={screen.showForm}
        onClose={screen.closeForm}
        onSubmit={screen.editTx ? screen.handleEdit : screen.handleCreate}
        transaction={screen.editTx}
        accounts={screen.accounts}
        categories={screen.categories}
      />

      <CSVImportModal
        open={screen.showImport}
        onClose={() => screen.setShowImport(false)}
        onImport={screen.importCSV}
        accounts={screen.accounts}
      />
    </div>
  );
}
