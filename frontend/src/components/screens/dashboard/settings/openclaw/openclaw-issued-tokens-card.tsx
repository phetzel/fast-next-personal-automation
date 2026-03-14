import { Loader2, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Separator,
} from "@/components/ui";
import type { OpenClawToken } from "@/types";

import { formatOpenClawDate, getOpenClawRoutesForScopes } from "./constants";

interface OpenClawIssuedTokensCardProps {
  loading: boolean;
  revokingId: string | null;
  tokens: OpenClawToken[];
  onRevoke: (tokenId: string) => void;
}

function OpenClawIssuedTokenItem({
  revokingId,
  token,
  onRevoke,
}: {
  revokingId: string | null;
  token: OpenClawToken;
  onRevoke: (tokenId: string) => void;
}) {
  const routes = getOpenClawRoutesForScopes(token.scopes);

  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{token.name}</span>
          <Badge variant={token.is_active ? "secondary" : "outline"}>
            {token.is_active ? "Active" : "Revoked"}
          </Badge>
        </div>
        <dl className="text-muted-foreground grid gap-1 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-foreground font-medium">Created</dt>
            <dd>{formatOpenClawDate(token.created_at)}</dd>
          </div>
          <div>
            <dt className="text-foreground font-medium">Last used</dt>
            <dd>{formatOpenClawDate(token.last_used_at)}</dd>
          </div>
          <div>
            <dt className="text-foreground font-medium">Expires</dt>
            <dd>{formatOpenClawDate(token.expires_at)}</dd>
          </div>
          <div>
            <dt className="text-foreground font-medium">Token ID</dt>
            <dd className="font-mono text-xs break-all">{token.id}</dd>
          </div>
        </dl>
        <Separator />
        <div className="space-y-3">
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Scopes</p>
            <div className="flex flex-wrap gap-2">
              {token.scopes.map((scope) => (
                <Badge key={scope} variant="outline">
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-foreground text-sm font-medium">Available routes</p>
            <div className="space-y-1">
              <p className="text-muted-foreground font-mono text-xs">Header: X-Integration-Token</p>
              {routes.map((route) => (
                <p key={`${token.id}-${route}`} className="text-muted-foreground font-mono text-xs">
                  {route}
                </p>
              ))}
            </div>
          </div>
        </div>
      </div>
      <Button
        disabled={!token.is_active || revokingId === token.id}
        onClick={() => onRevoke(token.id)}
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
  );
}

export function OpenClawIssuedTokensCard({
  loading,
  revokingId,
  tokens,
  onRevoke,
}: OpenClawIssuedTokensCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Issued Tokens</CardTitle>
        <CardDescription>
          These tokens are scoped to the current user. Ingested jobs will be written into this user
          account.
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
            <OpenClawIssuedTokenItem
              key={token.id}
              revokingId={revokingId}
              token={token}
              onRevoke={onRevoke}
            />
          ))
        )}
      </CardContent>
    </Card>
  );
}
