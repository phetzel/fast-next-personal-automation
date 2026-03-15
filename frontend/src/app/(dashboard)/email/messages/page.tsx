"use client";

import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import {
  MessageList,
  MessageSourceSelector,
  useEmailMessagesScreen,
} from "@/components/screens/dashboard/email/messages";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { Inbox, AlertCircle } from "lucide-react";

export default function EmailMessagesPage() {
  const screen = useEmailMessagesScreen();

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Browse processed email messages" />

      <MessageSourceSelector
        sources={screen.sources}
        selectedSource={screen.selectedSource}
        onSelectSource={screen.onSelectSource}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-green-500" />
            {screen.selectedSource
              ? `Messages from ${screen.selectedSource.email_address}`
              : "Messages"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {screen.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : screen.sources.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No email sources connected"
              description="Connect your Gmail account to start syncing emails."
            />
          ) : screen.messages.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No messages found"
              description="Run a sync to fetch new emails."
            />
          ) : (
            <MessageList
              messages={screen.messages}
              expandedMessage={screen.expandedMessage}
              onExpandMessage={screen.onExpandMessage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
