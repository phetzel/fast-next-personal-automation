"use client";

import { useEffect } from "react";
import { usePipelineRuns, usePipelines } from "@/hooks";
import { RunStatsCard } from "./run-stats-card";
import { RunFilters } from "./run-filters";
import { RunHistoryTable } from "./run-history-table";
import { Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui";

/**
 * Complete pipeline run history view with stats, filters, and table.
 */
export function PipelineRunHistory() {
  const {
    runs,
    total,
    isLoading,
    error,
    filters,
    stats,
    statsLoading,
    hasMore,
    fetchRuns,
    fetchStats,
    updateFilters,
    resetFilters,
    loadMore,
  } = usePipelineRuns();

  const { pipelines } = usePipelines();

  // Fetch stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="mt-4 text-sm text-red-500">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchRuns()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Run History</h2>
          <p className="text-muted-foreground text-sm">
            {total} total run{total !== 1 && "s"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            fetchRuns();
            fetchStats();
          }}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          <span className="ml-2 hidden sm:inline">Refresh</span>
        </Button>
      </div>

      {/* Stats cards */}
      <RunStatsCard stats={stats} isLoading={statsLoading} />

      {/* Filters */}
      <RunFilters
        filters={filters}
        pipelines={pipelines}
        onFilterChange={updateFilters}
        onReset={resetFilters}
      />

      {/* Runs table */}
      <RunHistoryTable runs={runs} isLoading={isLoading} hasMore={hasMore} onLoadMore={loadMore} />
    </div>
  );
}
