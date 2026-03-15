"use client";

import { AlertCircle, Check } from "lucide-react";

import {
  OpenClawAlert,
  OpenClawApiExamplesCard,
  OpenClawIssuedTokensCard,
  OpenClawPlaintextTokenCard,
  OpenClawSettingsHeader,
  OpenClawTokenFormCard,
  useOpenClawSettingsScreen,
} from "@/components/screens/dashboard/settings/openclaw";

export default function OpenClawSettingsPage() {
  const screen = useOpenClawSettingsScreen();

  return (
    <div className="container mx-auto max-w-5xl space-y-6">
      <OpenClawSettingsHeader />

      {screen.error && (
        <OpenClawAlert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <p className="text-sm">{screen.error}</p>
        </OpenClawAlert>
      )}

      {screen.success && (
        <OpenClawAlert>
          <Check className="h-4 w-4 shrink-0" />
          <p className="text-sm">{screen.success}</p>
        </OpenClawAlert>
      )}

      {screen.createdToken && (
        <OpenClawPlaintextTokenCard
          copied={screen.copied}
          createdToken={screen.createdToken}
          onCopy={screen.onCopy}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        <OpenClawTokenFormCard
          creating={screen.creating}
          expiresAt={screen.expiresAt}
          name={screen.name}
          selectedScopes={screen.selectedScopes}
          onExpiresAtChange={screen.setExpiresAt}
          onNameChange={screen.setName}
          onScopeToggle={screen.onScopeToggle}
          onSubmit={screen.onCreate}
        />
        <OpenClawApiExamplesCard
          exampleToken={screen.createdToken?.token ?? "oct_your_token_here"}
          selectedExample={screen.selectedExample}
          onSelectedExampleChange={screen.setSelectedExample}
        />
      </div>

      <OpenClawIssuedTokensCard
        loading={screen.loading}
        revokingId={screen.revokingId}
        tokens={screen.tokens}
        onRevoke={screen.onRevoke}
      />
    </div>
  );
}
