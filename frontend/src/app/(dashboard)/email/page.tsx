"use client";

import {
  EmailOverviewHeader,
  EmailOverviewQuickActionsGrid,
  EmailOverviewStatsPanel,
  RecentSyncsPanel,
  useEmailOverviewScreen,
} from "@/components/screens/dashboard/email/overview";

export default function EmailOverviewPage() {
  const screen = useEmailOverviewScreen();

  return (
    <div className="space-y-6">
      <EmailOverviewHeader
        isSyncing={screen.isSyncing}
        hasSources={screen.sources.length > 0}
        onTriggerSync={screen.handleTriggerSync}
      />
      <EmailOverviewQuickActionsGrid />
      <EmailOverviewStatsPanel
        stats={screen.stats}
        sourcesCount={screen.sources.length}
        isLoading={screen.isLoading}
      />
      <RecentSyncsPanel
        syncs={screen.syncs}
        isLoading={screen.isLoading}
        sourcesCount={screen.sources.length}
      />
    </div>
  );
}
