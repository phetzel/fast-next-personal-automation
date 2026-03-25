import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";

interface EmailOverviewHeaderProps {
  isSyncing: boolean;
  isTriaging: boolean;
  hasSources: boolean;
  onTriggerSync: () => void;
  onTriggerTriage: () => void;
}

export function EmailOverviewHeader({
  isSyncing,
  isTriaging,
  hasSources,
  onTriggerSync,
  onTriggerTriage,
}: EmailOverviewHeaderProps) {
  return (
    <PageHeader
      title="Email Overview"
      description="Monitor email syncs and processing status"
      actions={
        <>
          <Button variant="outline" asChild>
            <Link href={ROUTES.EMAIL_TRIAGE}>
              <Sparkles className="mr-2 h-4 w-4" />
              Open Triage
            </Link>
          </Button>
          <Button variant="outline" onClick={onTriggerTriage} disabled={isTriaging || !hasSources}>
            {isTriaging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Triaging...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Run Triage
              </>
            )}
          </Button>
          <Button onClick={onTriggerSync} disabled={isSyncing || !hasSources}>
            {isSyncing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Sync Now
              </>
            )}
          </Button>
        </>
      }
    />
  );
}
