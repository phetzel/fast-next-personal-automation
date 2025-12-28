"use client";

import { useState } from "react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  Label,
} from "@/components/ui";
import { useJobs } from "@/hooks";
import { cn } from "@/lib/utils";
import {
  XCircle,
  Loader2,
  CheckCircle,
  ChevronDown,
  AlertTriangle,
} from "lucide-react";
import type { JobStatus, JobStats } from "@/types";

interface DismissByStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  stats: JobStats | null;
}

type DismissableStatus = "new" | "prepped" | "reviewed";

const STATUS_OPTIONS: { value: DismissableStatus; label: string; description: string }[] = [
  { value: "new", label: "New", description: "Jobs not yet prepped" },
  { value: "prepped", label: "Prepped", description: "Jobs with generated materials" },
  { value: "reviewed", label: "Reviewed", description: "Jobs marked as reviewed" },
];

/**
 * Modal for batch dismissing jobs by status.
 * Allows users to quickly clear out jobs they're not interested in.
 */
export function DismissByStatusModal({
  isOpen,
  onClose,
  onComplete,
  stats,
}: DismissByStatusModalProps) {
  const { dismissByStatus } = useJobs();
  const [selectedStatus, setSelectedStatus] = useState<DismissableStatus>("new");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getCountForStatus = (status: DismissableStatus): number => {
    if (!stats) return 0;
    return stats[status] ?? 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const count = await dismissByStatus(selectedStatus as JobStatus);
      setResult({ count });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss jobs");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (result) {
      onComplete?.();
    }
    setResult(null);
    setError(null);
    onClose();
  };

  const selectedCount = getCountForStatus(selectedStatus);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            Dismiss Jobs by Status
          </DialogTitle>
          <DialogDescription>
            Quickly dismiss all jobs with a specific status that you&apos;re not
            interested in pursuing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status selector */}
          <div className="space-y-2">
            <Label htmlFor="status">Select Status to Dismiss</Label>
            <div className="relative">
              <select
                id="status"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as DismissableStatus)}
                disabled={isSubmitting || result !== null}
                className={cn(
                  "border-input bg-background ring-offset-background",
                  "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border pl-3 pr-10 py-2",
                  "text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label} ({getCountForStatus(option.value)} jobs)
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">
              {STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.description}
            </p>
          </div>

          {/* Warning */}
          {selectedCount > 0 && !result && (
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="font-medium text-amber-600 dark:text-amber-400">
                    This will dismiss {selectedCount} job{selectedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Dismissed jobs will be moved out of your active list. This action
                    cannot be undone easily.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No jobs message */}
          {selectedCount === 0 && !result && (
            <div className="rounded-lg border border-muted bg-muted/30 p-4 text-center">
              <p className="text-sm text-muted-foreground">
                No jobs with &quot;{selectedStatus}&quot; status to dismiss.
              </p>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="font-medium text-green-600 dark:text-green-400">
                  {result.count} job{result.count !== 1 ? "s" : ""} dismissed
                </p>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t pt-4">
            {result ? (
              <Button type="button" onClick={handleClose}>
                Done
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleClose}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={isSubmitting || selectedCount === 0}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Dismissing...
                    </>
                  ) : (
                    <>
                      <XCircle className="mr-2 h-4 w-4" />
                      Dismiss {selectedCount} Job{selectedCount !== 1 ? "s" : ""}
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

