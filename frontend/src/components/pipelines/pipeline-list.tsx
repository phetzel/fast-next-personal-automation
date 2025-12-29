"use client";

import { useState, useMemo } from "react";
import { PipelineCard } from "./pipeline-card";
import { usePipelines } from "@/hooks";
import { Loader2, AlertCircle, Workflow, Filter, X } from "lucide-react";
import { Button, Badge } from "@/components/ui";

interface PipelineListProps {
  /** Optional: Pre-filter by area */
  area?: string;
  /** Optional: Pre-filter by tags */
  tags?: string[];
  /** Optional: Show filter controls (default: true) */
  showFilters?: boolean;
  /** Optional: Pipeline to expand by default */
  expandedPipeline?: string;
  /** Optional: Initial values for the expanded pipeline's form */
  initialValues?: Record<string, unknown>;
}

/**
 * Displays a grid of available pipelines with optional filtering.
 */
export function PipelineList({ 
  area: initialArea, 
  tags: initialTags, 
  showFilters = true,
  expandedPipeline,
  initialValues,
}: PipelineListProps) {
  const [selectedArea, setSelectedArea] = useState<string | null>(initialArea || null);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags || []);

  const {
    pipelines,
    isLoading,
    error,
    fetchPipelines,
    executePipeline,
    resetExecution,
    getExecutionState,
    availableAreas,
    availableTags,
  } = usePipelines();

  // Filter pipelines based on selected area and tags
  const filteredPipelines = useMemo(() => {
    let result = pipelines;

    if (selectedArea) {
      result = result.filter((p) => p.area === selectedArea);
    }

    if (selectedTags.length > 0) {
      result = result.filter((p) =>
        selectedTags.every((tag) => p.tags.includes(tag))
      );
    }

    return result;
  }, [pipelines, selectedArea, selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const clearFilters = () => {
    setSelectedArea(null);
    setSelectedTags([]);
  };

  const hasActiveFilters = selectedArea !== null || selectedTags.length > 0;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
        <p className="text-muted-foreground mt-4 text-sm">Loading pipelines...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <AlertCircle className="h-8 w-8 text-red-500" />
        <p className="mt-4 text-sm text-red-500">{error}</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => fetchPipelines()}>
          Retry
        </Button>
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="bg-muted rounded-full p-4">
          <Workflow className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No pipelines available</h3>
        <p className="text-muted-foreground mt-1 text-sm">
          Create a pipeline in the backend to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      {showFilters && (availableAreas.length > 0 || availableTags.length > 0) && (
        <div className="space-y-3 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Filter className="h-4 w-4" />
              Filters
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={clearFilters}
              >
                <X className="mr-1 h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>

          {/* Area filter */}
          {availableAreas.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Area</label>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={selectedArea === null ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setSelectedArea(null)}
                >
                  All
                </Badge>
                {availableAreas.map((area) => (
                  <Badge
                    key={area}
                    variant={selectedArea === area ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => setSelectedArea(area)}
                  >
                    {area}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Tags filter */}
          {availableTags.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground">Tags</label>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pipeline count */}
      {hasActiveFilters && (
        <p className="text-sm text-muted-foreground">
          Showing {filteredPipelines.length} of {pipelines.length} pipelines
        </p>
      )}

      {/* Pipeline grid */}
      {filteredPipelines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="bg-muted rounded-full p-4">
            <Filter className="text-muted-foreground h-8 w-8" />
          </div>
          <h3 className="mt-4 text-lg font-medium">No matching pipelines</h3>
          <p className="text-muted-foreground mt-1 text-sm">
            Try adjusting your filters to see more pipelines.
          </p>
          <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {filteredPipelines.map((pipeline) => {
            const execState = getExecutionState(pipeline.name);
            const isTargetPipeline = pipeline.name === expandedPipeline;
            return (
              <PipelineCard
                key={pipeline.name}
                pipeline={pipeline}
                executionState={execState}
                onExecute={(input) => executePipeline(pipeline.name, input)}
                onReset={() => resetExecution(pipeline.name)}
                onRetryWithProfile={(profileId) => {
                  // Retry with the last input, adding/overriding the profile_id
                  const lastInput = execState.lastInput || {};
                  executePipeline(pipeline.name, { ...lastInput, profile_id: profileId });
                }}
                defaultExpanded={isTargetPipeline}
                initialValues={isTargetPipeline ? initialValues : undefined}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

