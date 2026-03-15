"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { OpenClawTokenListResponse } from "@/types";

export function useOpenClawTokensQuery() {
  return useQuery({
    queryKey: queryKeys.openClaw.tokens(),
    queryFn: () => apiClient.get<OpenClawTokenListResponse>("/integrations/openclaw/tokens"),
  });
}
