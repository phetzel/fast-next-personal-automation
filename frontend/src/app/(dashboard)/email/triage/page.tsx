"use client";

import {
  TriageList,
  TriagePageHeader,
  TriageStatsStrip,
  useEmailTriageScreen,
} from "@/components/screens/dashboard/email/triage";

export default function EmailTriagePage() {
  const screen = useEmailTriageScreen();

  return (
    <div className="space-y-6">
      <TriagePageHeader
        lastRun={screen.stats?.last_run ?? null}
        isRunning={screen.isRunning}
        hasSources={screen.sources.length > 0}
        onRun={screen.onRun}
      />
      <TriageStatsStrip stats={screen.stats} />
      <TriageList
        bucket={screen.bucket}
        sourceId={screen.sourceId}
        reviewOnly={screen.reviewOnly}
        unsubscribeOnly={screen.unsubscribeOnly}
        sources={screen.sources}
        messages={screen.messages}
        isLoading={screen.isLoading}
        hasError={screen.hasError}
        hasSources={screen.sources.length > 0}
        onBucketChange={screen.onBucketChange}
        onSourceChange={screen.onSourceChange}
        onReviewOnlyChange={screen.onReviewOnlyChange}
        onUnsubscribeOnlyChange={screen.onUnsubscribeOnlyChange}
      />
    </div>
  );
}
