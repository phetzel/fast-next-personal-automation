"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { HealthResponse } from "@/types";

export function useHealthQuery() {
  return useQuery({
    queryKey: queryKeys.dashboard.health(),
    queryFn: () => apiClient.get<HealthResponse>("/health"),
  });
}
