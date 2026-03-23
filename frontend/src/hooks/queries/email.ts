"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  EmailConfig,
  EmailTriageListResponse,
  EmailTriageRunInput,
  EmailTriageRunResult,
  EmailTriageStats,
  EmailMessage,
  EmailSource,
  EmailSyncListResponse,
  EmailSyncStats,
} from "@/types";

function buildEmailSyncStats(syncResponse: EmailSyncListResponse): EmailSyncStats | null {
  const syncs = syncResponse.items;

  if (syncs.length === 0) {
    return null;
  }

  const successfulSyncs = syncs.filter((sync) => sync.status === "completed");
  const failedSyncs = syncs.filter((sync) => sync.status === "failed");

  return {
    total_syncs: syncs.length,
    successful_syncs: successfulSyncs.length,
    failed_syncs: failedSyncs.length,
    total_emails_processed: syncs.reduce((sum, sync) => sum + sync.emails_processed, 0),
    total_jobs_extracted: syncs.reduce(
      (sum, sync) => sum + (sync.sync_metadata?.jobs_extracted || 0),
      0
    ),
    total_jobs_saved: syncs.reduce((sum, sync) => sum + (sync.sync_metadata?.jobs_saved || 0), 0),
    last_sync: syncs[0] ?? null,
  };
}

export function useEmailSourcesQuery() {
  return useQuery({
    queryKey: queryKeys.email.sources(),
    queryFn: () => apiClient.get<EmailSource[]>("/email/sources"),
  });
}

export function useEmailConfigQuery(enabled = true) {
  return useQuery({
    queryKey: queryKeys.email.config(),
    queryFn: () => apiClient.get<EmailConfig>("/email/config"),
    enabled,
  });
}

export function useEmailSyncsQuery(limit = 20, offset = 0) {
  return useQuery({
    queryKey: queryKeys.email.syncs({ limit, offset }),
    queryFn: () =>
      apiClient.get<EmailSyncListResponse>(`/email/syncs?limit=${limit}&offset=${offset}`),
  });
}

export function useEmailMessagesQuery(sourceId: string | null, limit = 50) {
  return useQuery({
    queryKey: queryKeys.email.messages({ sourceId, limit }),
    queryFn: () =>
      apiClient.get<EmailMessage[]>(`/email/sources/${sourceId}/messages?limit=${limit}`),
    enabled: Boolean(sourceId),
  });
}

export function useEmailStatsQuery(limit = 100) {
  return useQuery({
    queryKey: queryKeys.email.stats(),
    queryFn: async () => {
      const syncResponse = await apiClient.get<EmailSyncListResponse>(
        `/email/syncs?limit=${limit}`
      );
      return buildEmailSyncStats(syncResponse);
    },
  });
}

export function useEmailTriageMessagesQuery(params: {
  bucket?: string;
  sourceId?: string | null;
  requiresReview?: boolean;
  unsubscribeCandidate?: boolean;
  limit?: number;
  offset?: number;
}) {
  const searchParams = new URLSearchParams();

  if (params.bucket && params.bucket !== "all") {
    searchParams.set("bucket", params.bucket);
  }
  if (params.sourceId) {
    searchParams.set("source_id", params.sourceId);
  }
  if (params.requiresReview) {
    searchParams.set("requires_review", "true");
  }
  if (params.unsubscribeCandidate) {
    searchParams.set("unsubscribe_candidate", "true");
  }
  searchParams.set("limit", String(params.limit ?? 100));
  searchParams.set("offset", String(params.offset ?? 0));

  return useQuery({
    queryKey: queryKeys.email.triageMessages(params),
    queryFn: () =>
      apiClient.get<EmailTriageListResponse>(`/email/triage/messages?${searchParams.toString()}`),
  });
}

export function useEmailTriageStatsQuery() {
  return useQuery({
    queryKey: queryKeys.email.triageStats(),
    queryFn: () => apiClient.get<EmailTriageStats>("/email/triage/stats"),
  });
}

export function useRunEmailTriageMutation() {
  return useMutation({
    mutationFn: (input: EmailTriageRunInput = {}) =>
      apiClient.post<EmailTriageRunResult>("/email/triage/run", input),
  });
}

export { buildEmailSyncStats };
