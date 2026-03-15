"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEmailSyncsQuery } from "@/hooks/queries/email";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

const PAGE_SIZE = 20;

export function useEmailSyncsScreen() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedSyncId, setSelectedSyncId] = useState("");

  const offset = (page - 1) * PAGE_SIZE;
  const syncsQuery = useEmailSyncsQuery(PAGE_SIZE, offset);

  const triggerSyncMutation = useMutation({
    mutationFn: (forceFullSync: boolean) =>
      apiClient.post<{ sync_id: string; status: string; message: string }>("/email/syncs", {
        force_full_sync: forceFullSync,
      }),
    onSuccess: async () => {
      setPage(1);
      await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
      toast.success("Email sync started");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to trigger email sync");
    },
  });

  const total = syncsQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return {
    syncs: syncsQuery.data?.items ?? [],
    total,
    page,
    totalPages,
    selectedSyncId,
    isLoading: syncsQuery.isLoading || syncsQuery.isFetching,
    isSyncing: triggerSyncMutation.isPending,
    setPage,
    setSelectedSyncId,
    handleTriggerSync: async () => {
      try {
        return await triggerSyncMutation.mutateAsync(false);
      } catch {
        return null;
      }
    },
  };
}
