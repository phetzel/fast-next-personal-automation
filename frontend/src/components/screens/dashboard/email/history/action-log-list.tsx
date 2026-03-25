"use client";

import { EmptyState } from "@/components/shared/feedback";
import { Card, CardContent, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";
import type { EmailActionLog } from "@/types";
import { History, Inbox } from "lucide-react";

interface ActionLogListProps {
  logs: EmailActionLog[];
  isLoading: boolean;
}

export function ActionLogList({ logs, isLoading }: ActionLogListProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="space-y-3 p-6">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (logs.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <EmptyState
            icon={Inbox}
            title="No cleanup history yet"
            description="Suggested cleanup actions and review decisions will appear here."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        {logs.map((log) => (
          <div
            key={log.id}
            className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-start sm:justify-between"
          >
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-sky-500/10 px-2 py-1 font-medium text-sky-700">
                  {log.action_type}
                </span>
                <span className="rounded-full bg-muted px-2 py-1 font-medium">
                  {log.action_status}
                </span>
                <span className="rounded-full bg-emerald-500/10 px-2 py-1 font-medium text-emerald-700">
                  {log.action_source}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {log.message_subject || log.sender_domain || "Cleanup event"}
                </p>
                <p className="text-muted-foreground text-sm">
                  {log.normalized_sender || log.sender_domain || "No sender metadata"}
                </p>
              </div>
              {log.reason ? <p className="text-muted-foreground text-sm">{log.reason}</p> : null}
            </div>
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <History className="h-4 w-4" />
              {formatDateTime(log.created_at)}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
