"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEnsureEmailTriageSchedule } from "@/hooks/use-email-triage-schedule-bootstrap";
import {
  useEmailSourcesQuery,
  useEmailTriageMessagesQuery,
  useEmailTriageStatsQuery,
  useRunEmailTriageMutation,
} from "@/hooks/queries/email";
import { queryKeys } from "@/lib/query-keys";
import type { EmailBucket } from "@/types";

export function useEmailTriageScreen() {
  const [bucket, setBucket] = useState<EmailBucket | "all">("all");
  const [sourceId, setSourceId] = useState<string | "all">("all");
  const [reviewOnly, setReviewOnly] = useState(false);
  const [unsubscribeOnly, setUnsubscribeOnly] = useState(false);
  const queryClient = useQueryClient();

  const sourcesQuery = useEmailSourcesQuery();
  const sources = sourcesQuery.data ?? [];
  useEnsureEmailTriageSchedule(sources);

  const statsQuery = useEmailTriageStatsQuery();
  const messagesQuery = useEmailTriageMessagesQuery({
    bucket,
    sourceId: sourceId === "all" ? null : sourceId,
    requiresReview: reviewOnly,
    unsubscribeCandidate: unsubscribeOnly,
    limit: 100,
    offset: 0,
  });
  const runMutation = useRunEmailTriageMutation();

  return {
    sources,
    stats: statsQuery.data ?? null,
    messages: messagesQuery.data?.items ?? [],
    bucket,
    sourceId,
    reviewOnly,
    unsubscribeOnly,
    isLoading:
      sourcesQuery.isLoading ||
      sourcesQuery.isFetching ||
      statsQuery.isLoading ||
      statsQuery.isFetching ||
      messagesQuery.isLoading ||
      messagesQuery.isFetching,
    isRunning: runMutation.isPending,
    hasError:
      Boolean(sourcesQuery.error) || Boolean(statsQuery.error) || Boolean(messagesQuery.error),
    onBucketChange: setBucket,
    onSourceChange: setSourceId,
    onReviewOnlyChange: setReviewOnly,
    onUnsubscribeOnlyChange: setUnsubscribeOnly,
    onRun: async () => {
      try {
        const result = await runMutation.mutateAsync({});
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success(`Triaged ${result.messages_triaged} messages`);
        return result;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to run email triage");
        return null;
      }
    },
  };
}
