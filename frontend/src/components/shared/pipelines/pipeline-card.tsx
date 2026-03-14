"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, Badge } from "@/components/ui";
import { DynamicForm } from "./dynamic-form";
import { ExecutionResult } from "./execution-result";
import type { PipelineInfo, ExecutionState } from "@/types";
import { ChevronDown, ChevronUp, Workflow, Tag as TagIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PipelineCardProps {
  pipeline: PipelineInfo;
  executionState: ExecutionState;
  onExecute: (input: Record<string, unknown>) => void;
  onReset: () => void;
  /** Called when user selects a profile after a profile_required error and wants to retry */
  onRetryWithProfile?: (profileId: string) => void;
  /** Initial values to pre-fill the form */
  initialValues?: Record<string, unknown>;
  /** Start expanded (e.g., when navigating with query params) */
  defaultExpanded?: boolean;
}

/**
 * Card component for a single pipeline with expandable form and results.
 */
export function PipelineCard({
  pipeline,
  executionState,
  onExecute,
  onReset,
  onRetryWithProfile,
  initialValues,
  defaultExpanded = false,
}: PipelineCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const isRunning = executionState.status === "running";
  const hasResult = executionState.status === "success" || executionState.status === "error";

  // Count required and optional fields
  const requiredCount = pipeline.input_schema.required?.length || 0;
  const totalFields = Object.keys(pipeline.input_schema.properties || {}).length;
  const optionalCount = totalFields - requiredCount;

  return (
    <Card
      className={cn(
        "transition-all duration-200",
        isExpanded && "ring-primary/20 ring-2",
        hasResult && executionState.status === "success" && "border-green-500/30",
        hasResult && executionState.status === "error" && "border-red-500/30"
      )}
    >
      <CardHeader className="cursor-pointer select-none" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="bg-primary/10 mt-0.5 rounded-lg p-2">
              <Workflow className="text-primary h-5 w-5" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">{pipeline.name}</CardTitle>
                {pipeline.area && (
                  <Badge variant="outline" className="text-xs font-normal">
                    {pipeline.area}
                  </Badge>
                )}
              </div>
              <CardDescription className="text-sm">{pipeline.description}</CardDescription>
              {/* Tags */}
              {pipeline.tags.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 pt-1">
                  <TagIcon className="text-muted-foreground h-3 w-3" />
                  {pipeline.tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="h-5 px-1.5 py-0 text-xs font-normal"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isRunning && (
              <Badge variant="secondary" className="animate-pulse">
                Running
              </Badge>
            )}
            {hasResult && executionState.status === "success" && (
              <Badge className="bg-green-500/10 text-green-600 hover:bg-green-500/20">
                Success
              </Badge>
            )}
            {hasResult && executionState.status === "error" && (
              <Badge variant="destructive">Error</Badge>
            )}
            <button
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Field summary */}
        {!isExpanded && totalFields > 0 && (
          <div className="text-muted-foreground mt-2 flex gap-3 text-xs">
            {requiredCount > 0 && (
              <span>
                {requiredCount} required field{requiredCount !== 1 && "s"}
              </span>
            )}
            {optionalCount > 0 && (
              <span>
                {optionalCount} optional field{optionalCount !== 1 && "s"}
              </span>
            )}
          </div>
        )}
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 border-t pt-4">
          {/* Dynamic form */}
          <DynamicForm
            schema={pipeline.input_schema}
            onSubmit={onExecute}
            isSubmitting={isRunning}
            submitLabel={isRunning ? "Running..." : "Run Pipeline"}
            initialValues={initialValues}
          />

          {/* Execution result */}
          {(hasResult || isRunning) && (
            <div className="mt-4">
              <ExecutionResult
                state={executionState}
                onReset={onReset}
                onRetryWithProfile={onRetryWithProfile}
              />
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
