import { FeatureLinkCard } from "@/components/shared/navigation";
import { ROUTES } from "@/lib/constants";
import { Inbox, RefreshCw } from "lucide-react";

export function EmailOverviewQuickActionsGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FeatureLinkCard
        href={ROUTES.EMAIL_SYNCS}
        icon={RefreshCw}
        title="Sync History"
        description="View past sync operations"
        tone="blue"
      />
      <FeatureLinkCard
        href={ROUTES.EMAIL_MESSAGES}
        icon={Inbox}
        title="Browse Messages"
        description="View processed emails"
        tone="green"
      />
    </div>
  );
}
