"use client";

import { useState } from "react";
import { Card, Button } from "@/components/ui";
import { RunStatusBadge } from "./run-status-badge";
import { TriggerBadge } from "./trigger-badge";
import { RunDetailModal } from "./run-detail-modal";
import type { PipelineRun } from "@/types";
import { ChevronRight, Loader2, History } from "lucide-react";

interface RunHistoryTableProps {
  runs: PipelineRun[];
  isLoading: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

export function RunHistoryTable({ runs, isLoading, hasMore, onLoadMore }: RunHistoryTableProps) {
  const [selectedRun, setSelectedRun] = useState<PipelineRun | null>(null);

  if (runs.length === 0 && !isLoading) {
    return (
      <Card className="flex flex-col items-center justify-center py-12">
        <div className="bg-muted rounded-full p-4">
          <History className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No runs found</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Pipeline runs will appear here once executed.
        </p>
      </Card>
    );
  }

  return (
    <>
      <Card className="overflow-hidden">
        {/* Desktop table */}
        <div className="hidden md:block">
          <table className="w-full">
            <thead className="bg-muted/50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Pipeline
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Trigger
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Duration
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium tracking-wider uppercase">
                  Time
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium tracking-wider uppercase">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {runs.map((run) => (
                <tr
                  key={run.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedRun(run)}
                >
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{run.pipeline_name}</p>
                      <p className="text-muted-foreground text-xs">{run.id.slice(0, 8)}...</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </td>
                  <td className="px-4 py-3">
                    <TriggerBadge trigger={run.trigger_type} />
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {formatDuration(run.duration_ms)}
                  </td>
                  <td className="text-muted-foreground px-4 py-3 text-sm">
                    {formatDate(run.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="text-muted-foreground inline h-4 w-4" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="divide-y md:hidden">
          {runs.map((run) => (
            <div
              key={run.id}
              className="hover:bg-muted/30 cursor-pointer p-4 transition-colors"
              onClick={() => setSelectedRun(run)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{run.pipeline_name}</p>
                  <p className="text-muted-foreground text-xs">{formatDate(run.created_at)}</p>
                </div>
                <ChevronRight className="text-muted-foreground h-5 w-5" />
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <RunStatusBadge status={run.status} />
                <TriggerBadge trigger={run.trigger_type} />
                {run.duration_ms !== null && (
                  <span className="text-muted-foreground text-xs">
                    {formatDuration(run.duration_ms)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Load more */}
        {(hasMore || isLoading) && (
          <div className="border-t p-4">
            <Button variant="outline" className="w-full" onClick={onLoadMore} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Loading...
                </>
              ) : (
                "Load More"
              )}
            </Button>
          </div>
        )}
      </Card>

      {/* Detail modal */}
      {selectedRun && <RunDetailModal run={selectedRun} onClose={() => setSelectedRun(null)} />}
    </>
  );
}
