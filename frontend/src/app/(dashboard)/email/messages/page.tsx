"use client";

import { useEffect, useState } from "react";
import { useEmailSyncs } from "@/hooks";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import { cn } from "@/lib/utils";
import {
  Inbox,
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ExternalLink,
} from "lucide-react";
import type { EmailSource } from "@/types";

export default function EmailMessagesPage() {
  const { sources, messages, isLoading, fetchSources, fetchMessages } = useEmailSyncs();
  const [selectedSource, setSelectedSource] = useState<EmailSource | null>(null);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getParserBadge = (parser: string | null) => {
    if (!parser) return null;
    return (
      <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
        {parser}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Messages</h1>
        <p className="text-muted-foreground">Browse processed email messages</p>
      </div>

      {/* Source selector */}
      {sources.length > 1 && (
        <div className="flex gap-2">
          {sources.map((source) => (
            <Button
              key={source.id}
              variant={selectedSource?.id === source.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedSource(source)}
            >
              <Mail className="mr-2 h-4 w-4" />
              {source.email_address}
            </Button>
          ))}
        </div>
      )}

      {/* Messages List */}
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
                <div key={i} className="bg-muted h-20 animate-pulse rounded-lg" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No email sources connected</p>
              <p className="text-muted-foreground mt-1 text-sm">
                Connect your Gmail account to start syncing emails
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="text-muted-foreground mx-auto mb-4 h-12 w-12" />
              <p className="text-muted-foreground">No messages found</p>
              <p className="text-muted-foreground mt-1 text-sm">Run a sync to fetch new emails</p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn("bg-card rounded-lg border p-4 transition-all", "hover:shadow-md")}
                >
                  <div
                    className="flex cursor-pointer items-start justify-between"
                    onClick={() =>
                      setExpandedMessage(expandedMessage === message.id ? null : message.id)
                    }
                  >
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        {message.processing_error ? (
                          <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
                        ) : (
                          <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
                        )}
                        <p className="truncate font-medium">{message.subject || "(No subject)"}</p>
                      </div>
                      <p className="text-muted-foreground truncate text-sm">
                        From: {message.from_address}
                      </p>
                    </div>
                    <div className="ml-4 flex flex-shrink-0 items-center gap-4">
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">{formatDate(message.received_at)}</p>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          {getParserBadge(message.parser_used)}
                          <span className="text-muted-foreground">
                            {message.jobs_extracted} job{message.jobs_extracted !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "text-muted-foreground h-5 w-5 transition-transform",
                          expandedMessage === message.id && "rotate-180"
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedMessage === message.id && (
                    <div className="mt-4 border-t pt-4">
                      <dl className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Message ID:</dt>
                          <dd className="font-mono text-xs">{message.gmail_message_id}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Processed At:</dt>
                          <dd>{formatDate(message.processed_at)}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Parser Used:</dt>
                          <dd>{message.parser_used || "None"}</dd>
                        </div>
                        <div className="flex justify-between">
                          <dt className="text-muted-foreground">Jobs Extracted:</dt>
                          <dd>{message.jobs_extracted}</dd>
                        </div>
                      </dl>
                      {message.processing_error && (
                        <div className="mt-4 rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                          <p className="font-medium">Processing Error:</p>
                          <p className="mt-1">{message.processing_error}</p>
                        </div>
                      )}
                      <div className="mt-4">
                        <Button variant="outline" size="sm" asChild>
                          <a
                            href={`https://mail.google.com/mail/u/0/#inbox/${message.gmail_message_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="mr-2 h-4 w-4" />
                            View in Gmail
                          </a>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
