"use client";

import { useEmailActionLogsQuery } from "@/hooks/queries/email";

export function useEmailHistoryScreen() {
  const logsQuery = useEmailActionLogsQuery(100, 0);

  return {
    logs: logsQuery.data?.items ?? [],
    total: logsQuery.data?.total ?? 0,
    isLoading: logsQuery.isLoading || logsQuery.isFetching,
  };
}
