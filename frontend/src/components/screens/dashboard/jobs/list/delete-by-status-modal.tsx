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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { useJobMutations } from "@/hooks";
import { Trash2, Loader2, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import type { JobStatus, JobStats } from "@/types";

interface DeleteByStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  stats: JobStats | null;
}

type DeletableStatus = "new" | "analyzed" | "prepped" | "reviewed";

const STATUS_OPTIONS: { value: DeletableStatus; label: string; description: string }[] = [
  { value: "new", label: "New", description: "Jobs waiting for analysis" },
  {
    value: "analyzed",
    label: "Analyzed",
    description: "Jobs ready for prep but not yet prepared",
  },
  { value: "prepped", label: "Prepped", description: "Jobs with generated materials" },
  { value: "reviewed", label: "Reviewed", description: "Jobs marked as reviewed" },
];

/**
 * Modal for batch deleting jobs by status.
 * Allows users to quickly clear out jobs they're not interested in.
 * Uses soft delete - jobs are hidden but preserved to prevent re-scraping.
 */
export function DeleteByStatusModal({
  isOpen,
  onClose,
  onComplete,
  stats,
}: DeleteByStatusModalProps) {
  const { deleteByStatus } = useJobMutations();
  const [selectedStatus, setSelectedStatus] = useState<DeletableStatus>("new");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getCountForStatus = (status: DeletableStatus): number => {
    if (!stats) return 0;
    return stats[status] ?? 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const count = await deleteByStatus(selectedStatus as JobStatus);
      setResult({ count });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete jobs");
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
            <Trash2 className="text-destructive h-5 w-5" />
            Delete Jobs by Status
          </DialogTitle>
          <DialogDescription>
            Quickly remove all jobs with a specific status that you&apos;re not interested in
            pursuing.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Status selector */}
          <div className="space-y-2">
            <Label htmlFor="status">Select Status to Delete</Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value as DeletableStatus)}
              disabled={isSubmitting || result !== null}
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label} ({getCountForStatus(option.value)} jobs)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">
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
                    This will delete {selectedCount} job{selectedCount !== 1 ? "s" : ""}
                  </p>
                  <p className="text-muted-foreground mt-1 text-sm">
                    Jobs will be removed from your list but preserved to prevent re-ingesting the
                    same posting later.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* No jobs message */}
          {selectedCount === 0 && !result && (
            <div className="border-muted bg-muted/30 rounded-lg border p-4 text-center">
              <p className="text-muted-foreground text-sm">
                No jobs with &quot;{selectedStatus}&quot; status to delete.
              </p>
            </div>
          )}

          {/* Success result */}
          {result && (
            <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <p className="font-medium text-green-600 dark:text-green-400">
                  {result.count} job{result.count !== 1 ? "s" : ""} deleted
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
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete {selectedCount} Job{selectedCount !== 1 ? "s" : ""}
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
