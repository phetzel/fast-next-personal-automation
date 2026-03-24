"use client";

import { EmptyState } from "@/components/shared/feedback";
import { Button, Card, CardContent, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";
import type { EmailSubscriptionGroup } from "@/types";
import { Archive, Inbox, ShieldCheck } from "lucide-react";

interface SubscriptionGroupsProps {
  groups: EmailSubscriptionGroup[];
  isLoading: boolean;
  onApprove: (messageId: string) => Promise<void>;
  onDismiss: (messageId: string) => Promise<void>;
}

export function SubscriptionGroups({
  groups,
  isLoading,
  onApprove,
  onDismiss,
}: SubscriptionGroupsProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-36 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={Inbox}
            title="No cleanup candidates"
            description="Newsletter and archive suggestions will appear here once triage finds them."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <Card key={group.sender_domain}>
          <CardContent className="space-y-4 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-2">
                <div>
                  <p className="font-semibold">{group.sender_domain}</p>
                  <p className="text-muted-foreground text-sm">{group.representative_sender}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-700">
                    {group.unsubscribe_count} unsubscribe
                  </span>
                  <span className="rounded-full bg-sky-500/10 px-2 py-1 font-medium text-sky-700">
                    {group.archive_count} archive
                  </span>
                  <span className="rounded-full bg-muted px-2 py-1 font-medium">
                    {group.total_messages} messages
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">
                  Latest activity: {formatDateTime(group.latest_received_at)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => onApprove(group.representative_message_id)}>
                  <Archive className="mr-2 h-4 w-4" />
                  Approve Cleanup
                </Button>
                <Button variant="outline" onClick={() => onDismiss(group.representative_message_id)}>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Always Keep
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              {group.sample_messages.map((message) => (
                <div key={message.id} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{message.subject || "(No subject)"}</p>
                      <p className="text-muted-foreground text-sm">
                        {message.source_email_address} · {formatDateTime(message.received_at)}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      {message.unsubscribe_candidate ? (
                        <span className="rounded-full bg-amber-500/10 px-2 py-1 font-medium text-amber-700">
                          unsubscribe
                        </span>
                      ) : null}
                      {message.archive_recommended ? (
                        <span className="rounded-full bg-sky-500/10 px-2 py-1 font-medium text-sky-700">
                          archive
                        </span>
                      ) : null}
                      {!message.unsubscribe_candidate && !message.archive_recommended ? (
                        <span className="rounded-full bg-muted px-2 py-1 font-medium">
                          keep
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
