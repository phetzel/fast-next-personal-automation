"use client";

import { useEffect, useState } from "react";
import { useEmailSyncs } from "@/hooks";
import { EmptyState } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import { MessageList, MessageSourceSelector } from "@/components/screens/dashboard/email/messages";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@/components/ui";
import { Inbox, AlertCircle } from "lucide-react";
import type { EmailSource } from "@/types";

export default function EmailMessagesPage() {
  const { sources, messages, isLoading, fetchSources, fetchMessages } = useEmailSyncs();
  const [selectedSource, setSelectedSource] = useState<EmailSource | null>(null);
  const [expandedMessage, setExpandedMessage] = useState("");

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  useEffect(() => {
    if (selectedSource) {
      fetchMessages(selectedSource.id);
    }
  }, [selectedSource, fetchMessages]);

  // Auto-select first source
  useEffect(() => {
    if (sources.length > 0 && !selectedSource) {
      setSelectedSource(sources[0]);
    }
  }, [sources, selectedSource]);

  return (
    <div className="space-y-6">
      <PageHeader title="Messages" description="Browse processed email messages" />

      <MessageSourceSelector
        sources={sources}
        selectedSource={selectedSource}
        onSelectSource={setSelectedSource}
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Inbox className="h-5 w-5 text-green-500" />
            {selectedSource ? `Messages from ${selectedSource.email_address}` : "Messages"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <EmptyState
              icon={AlertCircle}
              title="No email sources connected"
              description="Connect your Gmail account to start syncing emails."
            />
          ) : messages.length === 0 ? (
            <EmptyState
              icon={Inbox}
              title="No messages found"
              description="Run a sync to fetch new emails."
            />
          ) : (
            <MessageList
              messages={messages}
              expandedMessage={expandedMessage}
              onExpandMessage={setExpandedMessage}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
