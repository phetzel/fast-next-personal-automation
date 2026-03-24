"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useApproveEmailSubscriptionMutation,
  useDismissEmailSubscriptionMutation,
  useEmailSubscriptionsQuery,
} from "@/hooks/queries/email";
import { queryKeys } from "@/lib/query-keys";

export function useEmailSubscriptionsScreen() {
  const queryClient = useQueryClient();
  const subscriptionsQuery = useEmailSubscriptionsQuery(100, 0);
  const approveMutation = useApproveEmailSubscriptionMutation();
  const dismissMutation = useDismissEmailSubscriptionMutation();

  return {
    groups: subscriptionsQuery.data?.items ?? [],
    total: subscriptionsQuery.data?.total ?? 0,
    isLoading: subscriptionsQuery.isLoading || subscriptionsQuery.isFetching,
    onApprove: async (messageId: string) => {
      try {
        await approveMutation.mutateAsync({ messageId, input: {} });
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success("Cleanup rule saved");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save cleanup rule");
      }
    },
    onDismiss: async (messageId: string) => {
      try {
        await dismissMutation.mutateAsync({ messageId, input: {} });
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success("Sender marked as keep");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to dismiss cleanup suggestion");
      }
    },
  };
}
