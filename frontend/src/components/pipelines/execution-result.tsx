"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { CopyButton } from "@/components/chat/copy-button";
import type { ExecutionState } from "@/types";
import { CheckCircle, XCircle, Loader2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExecutionResultProps {
  state: ExecutionState;
  onReset?: () => void;
}

/**
 * Displays the result of a pipeline execution.
 */
export function ExecutionResult({ state, onReset }: ExecutionResultProps) {
  const { status, result, startedAt, completedAt } = state;

  if (status === "idle") {
    return null;
  }

  const duration =
    startedAt && completedAt
      ? Math.round((completedAt.getTime() - startedAt.getTime()) / 1000 * 100) / 100
      : null;

  const statusConfig = {
    running: {
      icon: Loader2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      label: "Running...",
      animate: true,
    },
    success: {
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      label: "Success",
      animate: false,
    },
    error: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      label: "Error",
      animate: false,
    },
    idle: {
      icon: Clock,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      borderColor: "border-border",
      label: "Idle",
      animate: false,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const outputText = result?.output ? JSON.stringify(result.output, null, 2) : "";

  return (
    <Card className={cn("border", config.borderColor, config.bgColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={cn("h-5 w-5", config.color, config.animate && "animate-spin")}
            />
            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
          </div>
          {duration !== null && (
            <span className="text-muted-foreground text-xs">{duration}s</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Error message */}
        {result?.error && (
          <div className="rounded-md bg-red-500/10 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
          </div>
        )}

        {/* Output */}
        {result?.output && (
          <div className="group relative">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium">Output:</p>
              <CopyButton text={outputText} className="opacity-0 group-hover:opacity-100" />
            </div>
            <pre className="bg-background max-h-64 overflow-auto rounded-md border p-3 text-xs">
              {outputText}
            </pre>
          </div>
        )}

        {/* Run again button */}
        {status !== "running" && onReset && (
          <button
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Run again
          </button>
        )}
      </CardContent>
    </Card>
  );
}

