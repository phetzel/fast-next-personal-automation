import Link from "next/link";
import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui";
import { ROUTES } from "@/lib/constants";
import { formatDateTime } from "@/lib/formatters";
import type { EmailTriageLastRun } from "@/types";
import { CalendarDays, Loader2, Sparkles } from "lucide-react";

interface TriagePageHeaderProps {
  lastRun: EmailTriageLastRun | null;
  isRunning: boolean;
  hasSources: boolean;
  onRun: () => void;
}

export function TriagePageHeader({ lastRun, isRunning, hasSources, onRun }: TriagePageHeaderProps) {
  const description = lastRun?.completed_at
    ? `Last successful triage: ${formatDateTime(lastRun.completed_at)}`
    : "Run read-only triage to classify recent Gmail messages into buckets.";

  return (
    <PageHeader
      title="Email Triage"
      description={description}
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href={ROUTES.SCHEDULES}>
              <CalendarDays className="mr-2 h-4 w-4" />
              Schedules
            </Link>
          </Button>
          <Button onClick={onRun} disabled={!hasSources || isRunning}>
            {isRunning ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Triage
              </>
            )}
          </Button>
        </>
      }
    />
  );
}
