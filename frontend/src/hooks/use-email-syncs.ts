"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/lib/api-client";
import type {
  EmailSync,
  EmailSyncListResponse,
  EmailSyncStats,
  EmailSource,
  EmailMessage,
} from "@/types";

/**
 * Hook for managing email syncs and sources.
 */
export function useEmailSyncs() {
  const [syncs, setSyncs] = useState<EmailSync[]>([]);
  const [total, setTotal] = useState(0);
  const [sources, setSources] = useState<EmailSource[]>([]);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [stats, setStats] = useState<EmailSyncStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch sync history.
   */
  const fetchSyncs = useCallback(async (limit = 20, offset = 0) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<EmailSyncListResponse>(
        `/email/syncs?limit=${limit}&offset=${offset}`
      );
      setSyncs(response.items);
      setTotal(response.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch syncs");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Fetch email sources.
   */
  const fetchSources = useCallback(async () => {
    try {
      const response = await apiClient.get<EmailSource[]>("/email/sources");
      setSources(response);
      return response;
    } catch {
      // Sources are optional
      return [];
    }
  }, []);

  /**
   * Fetch messages for a source.
   */
  const fetchMessages = useCallback(async (sourceId: string, limit = 50) => {
    try {
      const response = await apiClient.get<EmailMessage[]>(
        `/email/sources/${sourceId}/messages?limit=${limit}`
      );
      setMessages(response);
      return response;
    } catch {
      return [];
    }
  }, []);

  /**
   * Trigger a new email sync.
   */
  const triggerSync = useCallback(
    async (forceFullSync = false) => {
      setIsSyncing(true);
      setError(null);

      try {
        const response = await apiClient.post<{ sync_id: string; status: string; message: string }>(
          "/email/syncs",
          { force_full_sync: forceFullSync }
        );
        // Refresh syncs list after triggering
        await fetchSyncs();
        return response;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to trigger sync");
        return null;
      } finally {
        setIsSyncing(false);
      }
    },
    [fetchSyncs]
  );

  /**
   * Calculate stats from sync history.
   */
  const calculateStats = useCallback(async () => {
    try {
      const [syncResponse, sourcesData] = await Promise.all([
        apiClient.get<EmailSyncListResponse>("/email/syncs?limit=100"),
        apiClient.get<EmailSource[]>("/email/sources"),
      ]);

      const allSyncs = syncResponse.items;
      const successfulSyncs = allSyncs.filter((s) => s.status === "completed");
      const failedSyncs = allSyncs.filter((s) => s.status === "failed");

      const totalEmailsProcessed = allSyncs.reduce((sum, s) => sum + s.emails_processed, 0);
      const totalJobsExtracted = allSyncs.reduce(
        (sum, s) => sum + (s.sync_metadata?.jobs_extracted || 0),
        0
      );
      const totalJobsSaved = allSyncs.reduce(
        (sum, s) => sum + (s.sync_metadata?.jobs_saved || 0),
        0
      );

      const calculatedStats: EmailSyncStats = {
        total_syncs: allSyncs.length,
        successful_syncs: successfulSyncs.length,
        failed_syncs: failedSyncs.length,
        total_emails_processed: totalEmailsProcessed,
        total_jobs_extracted: totalJobsExtracted,
        total_jobs_saved: totalJobsSaved,
        last_sync: allSyncs.length > 0 ? allSyncs[0] : null,
      };

      setStats(calculatedStats);
      setSources(sourcesData);
      return calculatedStats;
    } catch {
      return null;
    }
  }, []);

  return {
    // State
    syncs,
    total,
    sources,
    messages,
    stats,
    isLoading,
    isSyncing,
    error,

    // Actions
    fetchSyncs,
    fetchSources,
    fetchMessages,
    triggerSync,
    calculateStats,
  };
}
