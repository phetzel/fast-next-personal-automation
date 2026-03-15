"use client";

import { useMemo } from "react";
import { useFinances } from "@/hooks";
import { formatCurrency, formatMonthYear } from "@/lib/formatters";

export function useFinancesOverviewScreen() {
  const now = useMemo(() => new Date(), []);
  const budgetMonthYear = useMemo(
    () => ({
      month: now.getMonth() + 1,
      year: now.getFullYear(),
    }),
    [now]
  );

  const screen = useFinances({
    initialFilters: {
      page: 1,
      page_size: 10,
      sort_by: "transaction_date",
      sort_order: "desc",
    },
    budgetMonthYear,
  });

  return {
    ...screen,
    monthLabel: formatMonthYear(now),
    formatCurrency,
  };
}
