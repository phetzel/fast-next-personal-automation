import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui";
import { Loader2, RefreshCw } from "lucide-react";

interface EmailOverviewHeaderProps {
  isSyncing: boolean;
  hasSources: boolean;
  onTriggerSync: () => void;
}

export function EmailOverviewHeader({
  isSyncing,
  hasSources,
  onTriggerSync,
}: EmailOverviewHeaderProps) {
  return (
    <PageHeader
      title="Email Overview"
      description="Monitor email syncs and processing status"
      actions={
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
      }
    />
  );
}
