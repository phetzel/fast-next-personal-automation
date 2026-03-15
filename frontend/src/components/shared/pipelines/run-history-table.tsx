"use client";

import { useState } from "react";
import {
  Button,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatDuration, formatRelativeTime } from "@/lib/formatters";
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
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="px-4 py-3 text-xs tracking-wider uppercase">
                  Pipeline
                </TableHead>
                <TableHead className="px-4 py-3 text-xs tracking-wider uppercase">Status</TableHead>
                <TableHead className="px-4 py-3 text-xs tracking-wider uppercase">
                  Trigger
                </TableHead>
                <TableHead className="px-4 py-3 text-xs tracking-wider uppercase">
                  Duration
                </TableHead>
                <TableHead className="px-4 py-3 text-xs tracking-wider uppercase">Time</TableHead>
                <TableHead className="px-4 py-3 text-right text-xs tracking-wider uppercase">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow
                  key={run.id}
                  className="hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setSelectedRun(run)}
                >
                  <TableCell className="px-4 py-3">
                    <div>
                      <p className="font-medium">{run.pipeline_name}</p>
                      <p className="text-muted-foreground text-xs">{run.id.slice(0, 8)}...</p>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <RunStatusBadge status={run.status} />
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <TriggerBadge trigger={run.trigger_type} />
                  </TableCell>
                  <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                    {formatDuration(run.duration_ms)}
                  </TableCell>
                  <TableCell className="text-muted-foreground px-4 py-3 text-sm">
                    {formatRelativeTime(run.created_at)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-right">
                    <ChevronRight className="text-muted-foreground inline h-4 w-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
                  <p className="text-muted-foreground text-xs">
                    {formatRelativeTime(run.created_at)}
                  </p>
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
