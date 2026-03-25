"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/layout";
import { Button } from "@/components/ui";
import { ActionLogList, useEmailHistoryScreen } from "@/components/screens/dashboard/email/history";
import { ROUTES } from "@/lib/constants";

export default function EmailHistoryPage() {
  const screen = useEmailHistoryScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cleanup History"
        description="Audit the cleanup suggestions and review decisions made in the email area."
        actions={
          <Button variant="outline" asChild>
            <Link href={ROUTES.EMAIL_SYNCS}>Open Sync History</Link>
          </Button>
        }
      />
      <ActionLogList logs={screen.logs} isLoading={screen.isLoading} />
    </div>
  );
}
