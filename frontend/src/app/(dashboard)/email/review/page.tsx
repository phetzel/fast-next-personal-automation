"use client";

import { PageHeader } from "@/components/shared/layout";
import { ReviewQueue, useEmailReviewScreen } from "@/components/screens/dashboard/email/review";

export default function EmailReviewPage() {
  const screen = useEmailReviewScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Review"
        description="Resolve ambiguous or low-confidence email triage items."
      />
      <ReviewQueue
        messages={screen.messages}
        isLoading={screen.isLoading}
        onReview={screen.onReview}
      />
    </div>
  );
}
