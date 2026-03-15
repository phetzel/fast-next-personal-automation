"use client";

import { EmptyState, PaginationControls } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { SyncHistoryList, useEmailSyncsScreen } from "@/components/screens/dashboard/email/syncs";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function EmailSyncsPage() {
  const screen = useEmailSyncsScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync History"
        description="View all email sync operations"
        actions={
          <Button onClick={screen.handleTriggerSync} disabled={screen.isSyncing}>
            {screen.isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>All Syncs ({screen.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {screen.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : screen.syncs.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No syncs found"
              description="Click 'Sync Now' to start syncing emails."
            />
          ) : (
            <SyncHistoryList
              syncs={screen.syncs}
              selectedSyncId={screen.selectedSyncId}
              onSelectSync={screen.setSelectedSyncId}
            />
          )}

          <PaginationControls
            page={screen.page}
            totalPages={screen.totalPages}
            summary={`Page ${screen.page} of ${screen.totalPages}`}
            onPrevious={() => screen.setPage(screen.page - 1)}
            onNext={() => screen.setPage(screen.page + 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
