"use client";

import { useState, type FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/shared/feedback";
import { useOpenClawTokensQuery } from "@/hooks/queries/openclaw";
import { apiClient, ApiError } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { OpenClawTokenCreateRequest, OpenClawTokenCreateResponse } from "@/types";
import { OPENCLAW_DEFAULT_SCOPES, type OpenClawExampleValue } from "./constants";

export function useOpenClawSettingsScreen() {
  const confirmDialog = useConfirmDialog();
  const queryClient = useQueryClient();
  const tokensQuery = useOpenClawTokensQuery();
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState("OpenClaw Prod");
  const [expiresAt, setExpiresAt] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>(OPENCLAW_DEFAULT_SCOPES);
  const [selectedExample, setSelectedExample] = useState<OpenClawExampleValue>("ingest");
  const [createdToken, setCreatedToken] = useState<OpenClawTokenCreateResponse | null>(null);

  const createMutation = useMutation({
    mutationFn: (payload: OpenClawTokenCreateRequest) =>
      apiClient.post<OpenClawTokenCreateResponse>("/integrations/openclaw/tokens", payload),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.openClaw.tokens() });
      setCreatedToken(response);
      setSuccess("Token created. Store the plaintext value now; it will not be shown again.");
      toast.success("OpenClaw token created");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Failed to create token";
      setError(message);
      toast.error(message);
    },
    onSettled: () => {
      setCreating(false);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: (tokenId: string) => apiClient.delete(`/integrations/openclaw/tokens/${tokenId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.openClaw.tokens() });
      setSuccess("Token revoked.");
      toast.success("OpenClaw token revoked");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof ApiError ? mutationError.message : "Failed to revoke token";
      setError(message);
      toast.error(message);
    },
    onSettled: () => {
      setRevokingId(null);
    },
  });

  return {
    tokens: tokensQuery.data?.items ?? [],
    loading: tokensQuery.isLoading || tokensQuery.isFetching,
    creating,
    revokingId,
    copied,
    error: error ?? (tokensQuery.error instanceof Error ? tokensQuery.error.message : null),
    success,
    name,
    expiresAt,
    selectedScopes,
    selectedExample,
    createdToken,
    setName,
    setExpiresAt,
    setSelectedExample,
    onScopeToggle: (scope: string, checked: boolean) => {
      setSelectedScopes((current) => {
        if (checked) {
          return current.includes(scope) ? current : [...current, scope];
        }

        return current.filter((value) => value !== scope);
      });
    },
    onCreate: async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setCreating(true);
      setError(null);
      setSuccess(null);
      setCopied(false);

      const payload: OpenClawTokenCreateRequest = {
        name: name.trim(),
        scopes: selectedScopes,
      };

      if (expiresAt) {
        payload.expires_at = new Date(expiresAt).toISOString();
      }

      try {
        return await createMutation.mutateAsync(payload);
      } catch {
        return null;
      }
    },
    onRevoke: async (tokenId: string) => {
      const confirmed = await confirmDialog({
        title: "Revoke OpenClaw token?",
        description:
          "Clawbot will stop being able to call its scoped job endpoints with this token.",
        confirmLabel: "Revoke token",
        destructive: true,
      });

      if (!confirmed) {
        return false;
      }

      setRevokingId(tokenId);
      setError(null);
      setSuccess(null);

      try {
        await revokeMutation.mutateAsync(tokenId);
        return true;
      } catch {
        return false;
      }
    },
    onCopy: async () => {
      if (!createdToken) {
        return;
      }

      try {
        await navigator.clipboard.writeText(createdToken.token);
        setCopied(true);
        toast.success("Token copied to clipboard");
      } catch {
        setError("Failed to copy token to clipboard");
        toast.error("Failed to copy token to clipboard");
      }
    },
  };
}
