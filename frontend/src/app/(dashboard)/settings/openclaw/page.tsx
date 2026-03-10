"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  AlertCircle,
  Check,
  Copy,
  KeyRound,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { apiClient, ApiError } from "@/lib/api-client";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";
import type {
  OpenClawToken,
  OpenClawTokenCreateRequest,
  OpenClawTokenCreateResponse,
  OpenClawTokenListResponse,
} from "@/types";

function Alert({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive";
}) {
  const styles =
    variant === "destructive"
      ? "border-destructive/50 bg-destructive/10 text-destructive"
      : "border-green-500/40 bg-green-50 text-green-700";

  return <div className={`flex items-start gap-3 rounded-lg border p-4 ${styles}`}>{children}</div>;
}

function formatDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}

export default function OpenClawSettingsPage() {
  const [tokens, setTokens] = useState<OpenClawToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [name, setName] = useState("OpenClaw Prod");
  const [expiresAt, setExpiresAt] = useState("");
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

    fetchTokens();
  }, []);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCreating(true);
    setError(null);
    setSuccess(null);
    setCopied(false);

    const payload: OpenClawTokenCreateRequest = {
      name: name.trim(),
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

  const handleRevoke = async (tokenId: string) => {
    if (!confirm("Revoke this OpenClaw token? Clawbot will stop being able to ingest jobs.")) {
      return;
    }

    setRevokingId(tokenId);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.delete(`/integrations/openclaw/tokens/${tokenId}`);
      setTokens((current) =>
        current.map((token) =>
          token.id === tokenId ? { ...token, is_active: false } : token
        )
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

  const exampleToken = createdToken?.token ?? "oct_your_token_here";
  const ingestExample = `curl --fail-with-body --silent --show-error \\
  -X POST \"$APP_API_BASE_URL/api/v1/integrations/openclaw/jobs/ingest\" \\
  -H \"Content-Type: application/json\" \\
  -H \"X-Integration-Token: ${exampleToken}\" \\
  --data '{
    \"jobs\": [
      {
        \"title\": \"Backend Engineer\",
        \"company\": \"Example Co\",
        \"job_url\": \"https://jobs.example.com/backend-engineer\",
        \"location\": \"Remote\",
        \"source\": \"linkedin\"
      }
    ],
    \"search_terms\": \"backend engineer remote\"
  }'`;

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <KeyRound className="h-8 w-8" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">OpenClaw Jobs</h1>
            <p className="text-muted-foreground">
              Create a scoped machine token so OpenClaw or Clawbot can add jobs through the
              existing ingest endpoint.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Scope: jobs:ingest</Badge>
          <Badge variant="secondary">Header: X-Integration-Token</Badge>
          <Badge variant="secondary">Route: /api/v1/integrations/openclaw/jobs/ingest</Badge>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{error}</p>
        </Alert>
      )}

      {success && (
        <Alert>
          <Check className="h-4 w-4 shrink-0" />
          <p className="text-sm">{success}</p>
        </Alert>
      )}

      {createdToken && (
        <Card className="border-green-500/40">
          <CardHeader>
            <CardTitle>Plaintext Token</CardTitle>
            <CardDescription>
              This value is shown once. Put it into OpenClaw as
              `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN`.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted rounded-lg border p-4 font-mono text-sm break-all">
              {createdToken.token}
            </div>
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleCopy} type="button" variant="secondary">
                <Copy className="h-4 w-4" />
                {copied ? "Copied" : "Copy token"}
              </Button>
              <span className="text-muted-foreground text-sm">
                Token name: {createdToken.token_info.name}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Create Token</CardTitle>
            <CardDescription>
              Smallest supported scope is `jobs:ingest`. Leave expiry empty for a non-expiring
              token.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={handleCreate}>
              <div className="space-y-2">
                <Label htmlFor="token-name">Token name</Label>
                <Input
                  id="token-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="OpenClaw Prod"
                  maxLength={255}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="token-expires-at">Expires at</Label>
                <Input
                  id="token-expires-at"
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </div>

              <Button disabled={creating} type="submit">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck />}
                Create token
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Ingest Check</CardTitle>
            <CardDescription>
              Use the backend API origin for `$APP_API_BASE_URL`, not the Next.js frontend proxy.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <pre className="bg-muted overflow-x-auto rounded-lg border p-4 text-xs leading-6">
              {ingestExample}
            </pre>
            <p className="text-muted-foreground text-sm">
              The response includes `jobs_saved`, `duplicates_skipped`, `token_id`, and whether
              profile analysis ran.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Issued Tokens</CardTitle>
          <CardDescription>
            These tokens are scoped to the current user. Ingested jobs will be written into this
            user account.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading tokens
            </div>
          ) : tokens.length === 0 ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
              No OpenClaw tokens yet.
            </div>
          ) : (
            tokens.map((token) => (
              <div
                key={token.id}
                className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{token.name}</span>
                    <Badge variant={token.is_active ? "secondary" : "outline"}>
                      {token.is_active ? "Active" : "Revoked"}
                    </Badge>
                    {token.scopes.map((scope) => (
                      <Badge key={scope} variant="outline">
                        {scope}
                      </Badge>
                    ))}
                  </div>
                  <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="font-medium text-foreground">Created</dt>
                      <dd>{formatDate(token.created_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Last used</dt>
                      <dd>{formatDate(token.last_used_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Expires</dt>
                      <dd>{formatDate(token.expires_at)}</dd>
                    </div>
                    <div>
                      <dt className="font-medium text-foreground">Token ID</dt>
                      <dd className="font-mono text-xs break-all">{token.id}</dd>
                    </div>
                  </dl>
                </div>
                <Button
                  disabled={!token.is_active || revokingId === token.id}
                  onClick={() => handleRevoke(token.id)}
                  type="button"
                  variant="outline"
                >
                  {revokingId === token.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Revoke
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
