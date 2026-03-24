"use client";

import { useState } from "react";
import { EmptyState } from "@/components/shared/feedback";
import {
  Button,
  Card,
  CardContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
} from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";
import type { EmailBucket, EmailTriageMessage } from "@/types";
import { EyeOff, Inbox, MailCheck } from "lucide-react";

const REVIEW_BUCKETS: EmailBucket[] = [
  "now",
  "jobs",
  "finance",
  "newsletter",
  "notifications",
  "review",
  "done",
];

interface ReviewQueueProps {
  messages: EmailTriageMessage[];
  isLoading: boolean;
  onReview: (
    messageId: string,
    decision: "reviewed" | "ignored",
    bucket?: EmailBucket
  ) => Promise<void>;
}

export function ReviewQueue({ messages, isLoading, onReview }: ReviewQueueProps) {
  const [buckets, setBuckets] = useState<Record<string, EmailBucket>>({});

  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (messages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={Inbox}
            title="No review items"
            description="High-confidence triage items will skip this queue."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        {messages.map((message) => {
          const selectedBucket = buckets[message.id] ?? (message.bucket ?? "review");
          return (
            <div key={message.id} className="space-y-4 rounded-xl border p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="rounded-full bg-orange-500/10 px-2 py-1 font-medium text-orange-600">
                    Review
                  </span>
                  {message.bucket ? (
                    <span className="rounded-full bg-slate-500/10 px-2 py-1 font-medium text-slate-700">
                      {message.bucket}
                    </span>
                  ) : null}
                  {message.triage_confidence !== null ? (
                    <span className="rounded-full bg-muted px-2 py-1 font-medium">
                      {Math.round(message.triage_confidence * 100)}%
                    </span>
                  ) : null}
                </div>
                <div>
                  <p className="font-semibold">{message.subject || "(No subject)"}</p>
                  <p className="text-muted-foreground text-sm">
                    {message.from_address} · {message.source_email_address}
                  </p>
                </div>
                <p className="text-muted-foreground text-sm">{message.summary || "No summary available."}</p>
                <p className="text-muted-foreground text-xs">{formatDateTime(message.received_at)}</p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="w-full sm:w-64">
                  <Select
                    value={selectedBucket}
                    onValueChange={(value) =>
                      setBuckets((current) => ({
                        ...current,
                        [message.id]: value as EmailBucket,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Final bucket" />
                    </SelectTrigger>
                    <SelectContent>
                      {REVIEW_BUCKETS.map((bucket) => (
                        <SelectItem key={bucket} value={bucket}>
                          {bucket}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => onReview(message.id, "reviewed", selectedBucket)}>
                    <MailCheck className="mr-2 h-4 w-4" />
                    Mark Reviewed
                  </Button>
                  <Button variant="outline" onClick={() => onReview(message.id, "ignored")}>
                    <EyeOff className="mr-2 h-4 w-4" />
                    Ignore
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
