import { Button, Card, CardContent } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { Job, JobStatus } from "@/types";
import { JOB_STATUSES, JOB_STATUS_CONFIG, canTransitionTo, shouldGenerateReviewPdf } from "@/types";
import { Loader2 } from "lucide-react";

const STATUS_OPTIONS = JOB_STATUSES.map((status) => ({
  value: status,
  label: JOB_STATUS_CONFIG[status].label,
  description: JOB_STATUS_CONFIG[status].description,
}));

interface JobStatusBarProps {
  job: Job;
  isUpdating: boolean;
  isGeneratingPdf: boolean;
  isPrepping: boolean;
  onStatusChange: (status: JobStatus) => void;
}

export function JobStatusBar({
  job,
  isUpdating,
  isGeneratingPdf,
  isPrepping,
  onStatusChange,
}: JobStatusBarProps) {
  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-sm font-medium">Status:</span>
          {STATUS_OPTIONS.map((option) => {
            const isCurrentStatus = job.status === option.value;
            const canTransition = canTransitionTo(job.status, option.value);
            const isPreppedTransition = option.value === "prepped" && job.status === "analyzed";
            const isReviewedTransition = option.value === "reviewed" && job.status === "prepped";

            return (
              <Button
                key={option.value}
                variant={isCurrentStatus ? "default" : "outline"}
                size="sm"
                onClick={() => onStatusChange(option.value)}
                disabled={
                  isUpdating ||
                  isGeneratingPdf ||
                  isPrepping ||
                  (!isCurrentStatus && !canTransition)
                }
                title={option.description}
                className={cn(
                  !isCurrentStatus && !canTransition && "cursor-not-allowed opacity-40",
                  isPreppedTransition && canTransition && "border-cyan-500/50 hover:bg-cyan-500/10",
                  isReviewedTransition &&
                    canTransition &&
                    "border-purple-500/50 hover:bg-purple-500/10"
                )}
              >
                {isPrepping && option.value === "prepped" ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : isGeneratingPdf && option.value === "reviewed" ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : null}
                {option.label}
              </Button>
            );
          })}
        </div>
        {job.status === "new" && (
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="text-blue-600 dark:text-blue-400">Next step:</span> Capture the
            application requirements, then run prep.
          </p>
        )}
        {job.status === "analyzed" && (
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="text-cyan-600 dark:text-cyan-400">Next step:</span> Click
            &quot;Prepped&quot; to generate a tailored cover letter and screening answers.
          </p>
        )}
        {job.status === "prepped" && (
          <p className="text-muted-foreground mt-2 text-xs">
            <span className="text-purple-600 dark:text-purple-400">Next step:</span> Review your
            materials, then click &quot;Reviewed&quot;{" "}
            {shouldGenerateReviewPdf(job)
              ? "to generate a downloadable PDF."
              : "to move this job into the reviewed stage."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
