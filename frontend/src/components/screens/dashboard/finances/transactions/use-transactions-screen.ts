"use client";

import { useCallback, useEffect, useState } from "react";
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
    fetchTransactions,
    fetchAccounts,
    fetchCategories,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    markReviewed,
    importCSV,
    triggerCategorize,
    setFilters,
    resetFilters,
  } = useFinances();

  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [categorizing, setCategorizing] = useState(false);

  useEffect(() => {
    void fetchAccounts();
    void fetchTransactions();
    void fetchCategories();
  }, [fetchAccounts, fetchTransactions, fetchCategories]);

  const page = filters.page ?? DEFAULT_TRANSACTION_FILTERS.page ?? 1;
  const pageSize = filters.page_size ?? DEFAULT_TRANSACTION_FILTERS.page_size ?? 50;
  const totalPages = Math.ceil(total / pageSize);

  const refresh = useCallback(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  const handleCreate = useCallback(
    async (data: object) => {
      const created = await createTransaction(data);
      if (created) {
        void fetchTransactions();
      }
    },
    [createTransaction, fetchTransactions]
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
        void fetchTransactions();
      }
    },
    [editTx, fetchTransactions, updateTransaction]
  );

  const handleDelete = useCallback(
    async (transactionId: string) => {
      const deleted = await deleteTransaction(transactionId);
      if (deleted) {
        void fetchTransactions();
      }
    },
    [deleteTransaction, fetchTransactions]
  );

  const handleCategorize = useCallback(async () => {
    setCategorizing(true);
    try {
      await triggerCategorize();
      void fetchTransactions();
    } finally {
      setCategorizing(false);
    }
  }, [fetchTransactions, triggerCategorize]);

  const handleFilterChange = useCallback(
    (newFilters: Partial<TransactionFilters>) => {
      setFilters(newFilters);
      void fetchTransactions(newFilters);
    },
    [fetchTransactions, setFilters]
  );

  const handleReset = useCallback(() => {
    resetFilters();
    void fetchTransactions(DEFAULT_TRANSACTION_FILTERS);
  }, [fetchTransactions, resetFilters]);

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
    refresh,
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
