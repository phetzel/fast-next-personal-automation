"use client";

import { PageHeader } from "@/components/shared/layout";
import {
  SubscriptionGroups,
  useEmailSubscriptionsScreen,
} from "@/components/screens/dashboard/email/subscriptions";

export default function EmailSubscriptionsPage() {
  const screen = useEmailSubscriptionsScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Subscriptions"
        description="Approve cleanup rules for newsletters and low-value inbox senders."
      />
      <SubscriptionGroups
        groups={screen.groups}
        isLoading={screen.isLoading}
        onApprove={screen.onApprove}
        onDismiss={screen.onDismiss}
      />
    </div>
  );
}
