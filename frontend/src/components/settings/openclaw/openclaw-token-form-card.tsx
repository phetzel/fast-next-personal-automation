import type { FormEvent } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
} from "@/components/ui";

import { OPENCLAW_SCOPE_OPTIONS } from "./constants";

interface OpenClawTokenFormCardProps {
  creating: boolean;
  expiresAt: string;
  name: string;
  selectedScopes: string[];
  onExpiresAtChange: (value: string) => void;
  onNameChange: (value: string) => void;
  onScopeToggle: (scope: string, checked: boolean) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

export function OpenClawTokenFormCard({
  creating,
  expiresAt,
  name,
  selectedScopes,
  onExpiresAtChange,
  onNameChange,
  onScopeToggle,
  onSubmit,
}: OpenClawTokenFormCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Token</CardTitle>
        <CardDescription>
          Select only the scopes OpenClaw needs. Leave expiry empty for a non-expiring token.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="space-y-2">
            <Label htmlFor="token-name">Token name</Label>
            <Input
              id="token-name"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
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
              onChange={(event) => onExpiresAtChange(event.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Scopes</Label>
            <div className="space-y-2">
              {OPENCLAW_SCOPE_OPTIONS.map((scope) => {
                const checked = selectedScopes.includes(scope.value);

                return (
                  <label
                    key={scope.value}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) => onScopeToggle(scope.value, value === true)}
                      className="mt-0.5"
                    />
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{scope.label}</p>
                      <p className="text-muted-foreground text-xs">{scope.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <Button disabled={creating || selectedScopes.length === 0} type="submit">
            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck />}
            Create token
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
