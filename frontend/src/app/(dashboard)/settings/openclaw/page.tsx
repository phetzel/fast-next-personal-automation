"use client";

import { FormEvent, useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";

import {
  OPENCLAW_DEFAULT_SCOPES,
  OpenClawAlert,
  OpenClawApiExamplesCard,
  OpenClawIssuedTokensCard,
  OpenClawPlaintextTokenCard,
  OpenClawSettingsHeader,
  OpenClawTokenFormCard,
  type OpenClawExampleValue,
} from "@/components/screens/dashboard/settings/openclaw";
import { useConfirmDialog } from "@/components/shared/feedback";
import { apiClient, ApiError } from "@/lib/api-client";
import type {
  OpenClawToken,
  OpenClawTokenCreateRequest,
  OpenClawTokenCreateResponse,
  OpenClawTokenListResponse,
} from "@/types";

export default function OpenClawSettingsPage() {
  const confirmDialog = useConfirmDialog();
  const [tokens, setTokens] = useState<OpenClawToken[]>([]);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchTokens = async () => {
      try {
        setLoading(true);
        const data = await apiClient.get<OpenClawTokenListResponse>(
          "/integrations/openclaw/tokens"
        );
        setTokens(data.items);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "Failed to load OpenClaw integration tokens";
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    void fetchTokens();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
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
      const response = await apiClient.post<OpenClawTokenCreateResponse>(
        "/integrations/openclaw/tokens",
        payload
      );
      setCreatedToken(response);
      setTokens((current) => [response.token_info, ...current]);
      setSuccess("Token created. Store the plaintext value now; it will not be shown again.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to create token";
      setError(message);
    } finally {
      setCreating(false);
    }
  };

  const handleScopeToggle = (scope: string, checked: boolean) => {
    setSelectedScopes((current) => {
      if (checked) {
        return current.includes(scope) ? current : [...current, scope];
      }

      return current.filter((value) => value !== scope);
    });
  };

  const handleRevoke = async (tokenId: string) => {
    const confirmed = await confirmDialog({
      title: "Revoke OpenClaw token?",
      description: "Clawbot will stop being able to call its scoped job endpoints with this token.",
      confirmLabel: "Revoke token",
      destructive: true,
    });
    if (!confirmed) {
      return;
    }

    setRevokingId(tokenId);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.delete(`/integrations/openclaw/tokens/${tokenId}`);
      setTokens((current) =>
        current.map((token) => (token.id === tokenId ? { ...token, is_active: false } : token))
      );
      setSuccess("Token revoked.");
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Failed to revoke token";
      setError(message);
    } finally {
      setRevokingId(null);
    }
  };

  const handleCopy = async () => {
    if (!createdToken) {
      return;
    }

    try {
      await navigator.clipboard.writeText(createdToken.token);
      setCopied(true);
    } catch {
      setError("Failed to copy token to clipboard");
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <OpenClawSettingsHeader />

      {error && (
        <OpenClawAlert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </OpenClawAlert>
      )}

      {success && (
        <OpenClawAlert>
          <Check className="h-4 w-4 shrink-0" />
          <p className="text-sm">{success}</p>
        </OpenClawAlert>
      )}

      {createdToken && (
        <OpenClawPlaintextTokenCard
          copied={copied}
          createdToken={createdToken}
          onCopy={handleCopy}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <OpenClawTokenFormCard
          creating={creating}
          expiresAt={expiresAt}
          name={name}
          selectedScopes={selectedScopes}
          onExpiresAtChange={setExpiresAt}
          onNameChange={setName}
          onScopeToggle={handleScopeToggle}
          onSubmit={handleCreate}
        />
        <OpenClawApiExamplesCard
          exampleToken={createdToken?.token ?? "oct_your_token_here"}
          selectedExample={selectedExample}
          onSelectedExampleChange={setSelectedExample}
        />
      </div>

      <OpenClawIssuedTokensCard
        loading={loading}
        revokingId={revokingId}
        tokens={tokens}
        onRevoke={handleRevoke}
      />
    </div>
  );
}
