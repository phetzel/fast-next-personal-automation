"use client";

import { useQueries } from "@tanstack/react-query";
import { useAuth } from "@/hooks";
import { buildEmailSyncStats } from "@/hooks/queries/email";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type {
  EmailSource,
  EmailSyncListResponse,
  FinanceStats,
  HealthResponse,
  JobStats,
} from "@/types";

export function useDashboardScreen() {
  const { user } = useAuth();
  const [healthQuery, sourcesQuery, jobsStatsQuery, financesStatsQuery, emailStatsQuery] =
    useQueries({
      queries: [
        {
          queryKey: queryKeys.dashboard.health(),
          queryFn: () => apiClient.get<HealthResponse>("/health"),
        },
        {
          queryKey: queryKeys.email.sources(),
          queryFn: () => apiClient.get<EmailSource[]>("/email/sources"),
        },
        {
          queryKey: queryKeys.jobs.stats(),
          queryFn: () => apiClient.get<JobStats>("/jobs/stats"),
        },
        {
          queryKey: queryKeys.finances.stats(),
          queryFn: () => apiClient.get<FinanceStats>("/finances/stats"),
        },
        {
          queryKey: queryKeys.email.stats(),
          queryFn: async () => {
            const syncResponse =
              await apiClient.get<EmailSyncListResponse>("/email/syncs?limit=100");
            return buildEmailSyncStats(syncResponse);
          },
        },
      ],
    });

  const emailSources = sourcesQuery.data ?? [];

  return {
    user,
    health: healthQuery.data ?? null,
    healthLoading: healthQuery.isLoading || healthQuery.isFetching,
    healthError: Boolean(healthQuery.error),
    emailSources,
    emailLoading: sourcesQuery.isLoading || sourcesQuery.isFetching,
    hasConnectedEmail: emailSources.length > 0,
    jobsStats: jobsStatsQuery.data ?? null,
    jobsLoading: jobsStatsQuery.isLoading || jobsStatsQuery.isFetching,
    financesStats: financesStatsQuery.data ?? null,
    financesLoading: financesStatsQuery.isLoading || financesStatsQuery.isFetching,
    emailStats: emailStatsQuery.data ?? null,
    emailStatsLoading: emailStatsQuery.isLoading || emailStatsQuery.isFetching,
  };
}
