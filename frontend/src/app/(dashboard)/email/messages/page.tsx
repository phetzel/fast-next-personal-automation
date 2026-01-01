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
import type { EmailMessage, EmailSource } from "@/types";

export default function EmailMessagesPage() {
  const { sources, messages, isLoading, fetchSources, fetchMessages } = useEmailSyncs();
  const [selectedSource, setSelectedSource] = useState<EmailSource | null>(null);
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    if (selectedSource) {
      fetchMessages(selectedSource.id);
    }
  }, [selectedSource]);

  // Auto-select first source
  useEffect(() => {
    if (sources.length > 0 && !selectedSource) {
      setSelectedSource(sources[0]);
    }
  }, [sources]);

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
        <p className="text-muted-foreground">
          Browse processed email messages
        </p>
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
                <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : sources.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No email sources connected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect your Gmail account to start syncing emails
              </p>
            </div>
          ) : messages.length === 0 ? (
            <div className="py-12 text-center">
              <Inbox className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No messages found</p>
              <p className="text-sm text-muted-foreground mt-1">
                Run a sync to fetch new emails
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "p-4 rounded-lg border bg-card transition-all",
                    "hover:shadow-md"
                  )}
                >
                  <div
                    className="flex items-start justify-between cursor-pointer"
                    onClick={() => setExpandedMessage(
                      expandedMessage === message.id ? null : message.id
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {message.processing_error ? (
                          <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                        ) : (
                          <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                        )}
                        <p className="font-medium truncate">{message.subject || "(No subject)"}</p>
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        From: {message.from_address}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4 flex-shrink-0">
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          {formatDate(message.received_at)}
                        </p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          {getParserBadge(message.parser_used)}
                          <span className="text-muted-foreground">
                            {message.jobs_extracted} job{message.jobs_extracted !== 1 ? "s" : ""}
                          </span>
                        </div>
                      </div>
                      <ChevronDown
                        className={cn(
                          "h-5 w-5 text-muted-foreground transition-transform",
                          expandedMessage === message.id && "rotate-180"
                        )}
                      />
                    </div>
                  </div>

                  {/* Expanded details */}
                  {expandedMessage === message.id && (
                    <div className="mt-4 pt-4 border-t">
                      <dl className="text-sm space-y-2">
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
                        <div className="mt-4 p-3 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 text-sm">
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
