"use client";

import { useEffect } from "react";
import { useEmailSyncs } from "@/hooks";
import {
  EmailOverviewHeader,
  EmailOverviewQuickActionsGrid,
  EmailOverviewStatsPanel,
  RecentSyncsPanel,
} from "@/components/screens/dashboard/email/overview";

export default function EmailOverviewPage() {
  const { syncs, sources, stats, isLoading, isSyncing, fetchSyncs, calculateStats, triggerSync } =
    useEmailSyncs();

  // Fetch data on mount
  useEffect(() => {
    calculateStats();
    fetchSyncs(5);
  }, [calculateStats, fetchSyncs]);

  const handleTriggerSync = async () => {
    await triggerSync();
    calculateStats();
  };

  return (
    <div className="space-y-6">
      <EmailOverviewHeader
        isSyncing={isSyncing}
        hasSources={sources.length > 0}
        onTriggerSync={handleTriggerSync}
      />
      <EmailOverviewQuickActionsGrid />
      <EmailOverviewStatsPanel stats={stats} sourcesCount={sources.length} isLoading={isLoading} />
      <RecentSyncsPanel syncs={syncs} isLoading={isLoading} sourcesCount={sources.length} />
    </div>
  );
}
