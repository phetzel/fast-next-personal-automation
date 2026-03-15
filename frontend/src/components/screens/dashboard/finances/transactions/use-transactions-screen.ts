"use client";

import { useCallback, useState } from "react";
import { useFinances } from "@/hooks";
import type { Transaction, TransactionFilters } from "@/types";

const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  page: 1,
  page_size: 50,
  sort_by: "transaction_date",
  sort_order: "desc",
};

export function useTransactionsScreen() {
  const {
    transactions,
    total,
    isLoading,
    filters,
    accounts,
    accountsLoading,
    categories,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    markReviewed,
    importCSV,
    triggerCategorize,
    setFilters,
    resetFilters,
  } = useFinances({
    initialFilters: DEFAULT_TRANSACTION_FILTERS,
  });

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  const page = filters.page ?? DEFAULT_TRANSACTION_FILTERS.page ?? 1;
  const pageSize = filters.page_size ?? DEFAULT_TRANSACTION_FILTERS.page_size ?? 50;
  const totalPages = Math.ceil(total / pageSize);

  const handleCreate = useCallback(
    async (data: object) => {
      await createTransaction(data);
    },
    [createTransaction]
  );

  const handleEdit = useCallback(
    async (data: object) => {
      if (!editTx) {
        return;
      }

      const updated = await updateTransaction(
        editTx.id,
        data as Parameters<typeof updateTransaction>[1]
      );
      if (updated) {
        setShowForm(false);
        setEditTx(null);
      }
    },
    [editTx, updateTransaction]
  );

  const handleDelete = useCallback(
    async (transactionId: string) => deleteTransaction(transactionId),
    [deleteTransaction]
  );

  const handleCategorize = useCallback(async () => {
    setCategorizing(true);
    try {
      await triggerCategorize();
    } finally {
      setCategorizing(false);
    }
  }, [triggerCategorize]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<TransactionFilters>) => {
      setFilters(newFilters);
    },
    [setFilters]
  );

  const handleReset = useCallback(() => {
    resetFilters();
  }, [resetFilters]);

  const handlePageChange = useCallback(
    (nextPage: number) => {
      handleFilterChange({ page: nextPage });
    },
    [handleFilterChange]
  );

  const closeForm = useCallback(() => {
    setShowForm(false);
    setEditTx(null);
  }, []);

  return {
    transactions,
    total,
    isLoading,
    filters,
    accounts,
    accountsLoading,
    categories,
    page,
    pageSize,
    totalPages,
    showForm,
    showImport,
    editTx,
    categorizing,
    markReviewed,
    importCSV,
    setShowForm,
    setShowImport,
    setEditTx,
    closeForm,
    handleCreate,
    handleEdit,
    handleDelete,
    handleCategorize,
    handleFilterChange,
    handleReset,
    handlePageChange,
  };
}
