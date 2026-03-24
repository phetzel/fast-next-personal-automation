"use client";

import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useEmailTriageMessagesQuery,
  useReviewEmailTriageMessageMutation,
} from "@/hooks/queries/email";
import { queryKeys } from "@/lib/query-keys";
import type { EmailBucket } from "@/types";

export function useEmailReviewScreen() {
  const queryClient = useQueryClient();
  const messagesQuery = useEmailTriageMessagesQuery({
    requiresReview: true,
    limit: 100,
    offset: 0,
  });
  const reviewMutation = useReviewEmailTriageMessageMutation();

  return {
    messages: messagesQuery.data?.items ?? [],
    total: messagesQuery.data?.total ?? 0,
    isLoading: messagesQuery.isLoading || messagesQuery.isFetching,
    onReview: async (
      messageId: string,
      decision: "reviewed" | "ignored",
      bucket?: EmailBucket
    ) => {
      try {
        await reviewMutation.mutateAsync({
          messageId,
          input: {
            decision,
            bucket: decision === "reviewed" ? bucket ?? null : undefined,
          },
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success(decision === "reviewed" ? "Review saved" : "Message ignored");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to save review");
      }
    },
  };
}
