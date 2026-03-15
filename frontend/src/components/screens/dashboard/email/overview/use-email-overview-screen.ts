"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useEmailSourcesQuery,
  useEmailStatsQuery,
  useEmailSyncsQuery,
} from "@/hooks/queries/email";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";

export function useEmailOverviewScreen() {
  const queryClient = useQueryClient();
  const syncsQuery = useEmailSyncsQuery(5, 0);
  const sourcesQuery = useEmailSourcesQuery();
  const statsQuery = useEmailStatsQuery();

  const triggerSyncMutation = useMutation({
    mutationFn: (forceFullSync: boolean) =>
      apiClient.post<{ sync_id: string; status: string; message: string }>("/email/syncs", {
        force_full_sync: forceFullSync,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
      toast.success("Email sync started");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to trigger email sync");
    },
  });

  return {
    syncs: syncsQuery.data?.items ?? [],
    sources: sourcesQuery.data ?? [],
    stats: statsQuery.data ?? null,
    isLoading:
      syncsQuery.isLoading ||
      syncsQuery.isFetching ||
      sourcesQuery.isLoading ||
      sourcesQuery.isFetching ||
      statsQuery.isLoading ||
      statsQuery.isFetching,
    isSyncing: triggerSyncMutation.isPending,
    handleTriggerSync: async () => {
      try {
        return await triggerSyncMutation.mutateAsync(false);
      } catch {
        return null;
      }
    },
  };
}
