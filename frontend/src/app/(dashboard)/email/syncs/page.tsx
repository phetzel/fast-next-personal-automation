"use client";

import { useEffect, useState } from "react";
import { useEmailSyncs } from "@/hooks";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { EmailSync } from "@/types";

export default function EmailSyncsPage() {
  const { syncs, total, isLoading, isSyncing, fetchSyncs, triggerSync } = useEmailSyncs();
  const [page, setPage] = useState(1);
  const [selectedSync, setSelectedSync] = useState<EmailSync | null>(null);
  const limit = 20;

  useEffect(() => {
    fetchSyncs(limit, (page - 1) * limit);
  }, [page]);

  const handleTriggerSync = async () => {
    await triggerSync();
    setPage(1);
    fetchSyncs(limit, 0);
  };

  const totalPages = Math.ceil(total / limit);

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  // Format duration
  const formatDuration = (sync: EmailSync) => {
    if (!sync.completed_at) return "In progress";
    const start = new Date(sync.started_at);
    const end = new Date(sync.completed_at);
    const diffMs = end.getTime() - start.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    if (diffSecs < 60) return `${diffSecs}s`;
    const diffMins = Math.floor(diffSecs / 60);
    const remainingSecs = diffSecs % 60;
    return `${diffMins}m ${remainingSecs}s`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs font-medium text-green-600 dark:text-green-400">
            <CheckCircle className="h-3 w-3" />
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
            <XCircle className="h-3 w-3" />
            Failed
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
            <Loader2 className="h-3 w-3 animate-spin" />
            Running
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Sync History</h1>
          <p className="text-muted-foreground">
            View all email sync operations
          </p>
        </div>
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
      </div>

      {/* Sync List */}
      <Card>
        <CardHeader>
          <CardTitle>All Syncs ({total})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : syncs.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No syncs found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Click &apos;Sync Now&apos; to start syncing emails
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {syncs.map((sync) => (
                <div
                  key={sync.id}
                  onClick={() => setSelectedSync(selectedSync?.id === sync.id ? null : sync)}
                  className={cn(
                    "p-4 rounded-lg border bg-card cursor-pointer transition-all",
                    "hover:shadow-md hover:ring-2 hover:ring-primary/20",
                    selectedSync?.id === sync.id && "ring-2 ring-primary"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {getStatusBadge(sync.status)}
                      <div>
                        <p className="font-medium">{formatDate(sync.started_at)}</p>
                        <p className="text-sm text-muted-foreground">
                          Duration: {formatDuration(sync)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div className="text-center">
                        <p className="font-bold">{sync.sources_synced}</p>
                        <p className="text-muted-foreground">Sources</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{sync.emails_fetched}</p>
                        <p className="text-muted-foreground">Fetched</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{sync.emails_processed}</p>
                        <p className="text-muted-foreground">Processed</p>
                      </div>
                      <div className="text-center">
                        <p className="font-bold">{sync.sync_metadata?.jobs_saved || 0}</p>
                        <p className="text-muted-foreground">Jobs</p>
                      </div>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {selectedSync?.id === sync.id && (
                    <div className="mt-4 pt-4 border-t">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-medium mb-2">Sync Details</p>
                          <dl className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">ID:</dt>
                              <dd className="font-mono text-xs">{sync.id}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Started:</dt>
                              <dd>{formatDate(sync.started_at)}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Completed:</dt>
                              <dd>{sync.completed_at ? formatDate(sync.completed_at) : "N/A"}</dd>
                            </div>
                          </dl>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Job Statistics</p>
                          <dl className="text-sm space-y-1">
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Extracted:</dt>
                              <dd>{sync.sync_metadata?.jobs_extracted || 0}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Analyzed:</dt>
                              <dd>{sync.sync_metadata?.jobs_analyzed || 0}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">Saved:</dt>
                              <dd>{sync.sync_metadata?.jobs_saved || 0}</dd>
                            </div>
                            <div className="flex justify-between">
                              <dt className="text-muted-foreground">High Scoring:</dt>
                              <dd>{sync.sync_metadata?.high_scoring || 0}</dd>
                            </div>
                          </dl>
                        </div>
                      </div>
                      {sync.error_message && (
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
                          <p className="font-medium">Error:</p>
                          <p className="mt-1">{sync.error_message}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
