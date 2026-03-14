"use client";

import { useEffect, useState } from "react";
import { useEmailSyncs } from "@/hooks";
import { EmptyState, PaginationControls } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { SyncHistoryList } from "@/components/screens/dashboard/email/syncs";
import { Button, Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { RefreshCw, Loader2, AlertCircle } from "lucide-react";

export default function EmailSyncsPage() {
  const { syncs, total, isLoading, isSyncing, fetchSyncs, triggerSync } = useEmailSyncs();
  const [page, setPage] = useState(1);
  const [selectedSyncId, setSelectedSyncId] = useState("");
  const limit = 20;

  useEffect(() => {
    fetchSyncs(limit, (page - 1) * limit);
  }, [fetchSyncs, page]);

  const handleTriggerSync = async () => {
    await triggerSync();
    setPage(1);
    fetchSyncs(limit, 0);
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sync History"
        description="View all email sync operations"
        actions={
          <Button onClick={handleTriggerSync} disabled={isSyncing}>
            {isSyncing ? (
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
          <CardTitle>All Syncs ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : syncs.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No syncs found"
              description="Click 'Sync Now' to start syncing emails."
            />
          ) : (
            <SyncHistoryList
              syncs={syncs}
              selectedSyncId={selectedSyncId}
              onSelectSync={setSelectedSyncId}
            />
          )}

          <PaginationControls
            page={page}
            totalPages={totalPages}
            summary={`Page ${page} of ${totalPages}`}
            onPrevious={() => setPage(page - 1)}
            onNext={() => setPage(page + 1)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
