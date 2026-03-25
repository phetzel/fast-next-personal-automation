"use client";

import { StatusAlert } from "@/components/shared/feedback";
import {
  AutoActionsCard,
  ConnectedAccountsCard,
  EmailSettingsHeader,
  HowItWorksCard,
  SenderRulesCard,
  SupportedSourcesCard,
  useEmailSettingsScreen,
} from "@/components/screens/dashboard/settings/email";
import { Card, Skeleton } from "@/components/ui";
import { Check, AlertCircle } from "lucide-react";

export default function EmailSettingsPage() {
  const screen = useEmailSettingsScreen();

  if (screen.loading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6">
        <EmailSettingsHeader />
        <Card className="p-6">
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <EmailSettingsHeader />

      {screen.error && (
        <StatusAlert icon={AlertCircle} variant="destructive">
          {screen.error}
        </StatusAlert>
      )}

      {screen.success && (
        <StatusAlert
          icon={Check}
          className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
        >
          {screen.success}
        </StatusAlert>
      )}

      <ConnectedAccountsCard
        sources={screen.sources}
        connecting={screen.connecting}
        syncingSourceId={screen.syncingSourceId}
        onConnect={screen.onConnect}
        onSync={screen.onSync}
        onToggle={screen.onToggle}
        onDelete={screen.onDelete}
        formatDate={screen.formatDate}
      />

      <AutoActionsCard sources={screen.sources} />

      {screen.config && <SupportedSourcesCard config={screen.config} />}

      <SenderRulesCard
        senderRules={screen.senderRules}
        isSaving={screen.senderRulesSaving}
        onCreateRule={screen.onCreateSenderRule}
        onUpdateRule={screen.onUpdateSenderRule}
        onDeleteRule={screen.onDeleteSenderRule}
        onToggleRule={screen.onToggleSenderRule}
      />

      <HowItWorksCard />
    </div>
  );
}
