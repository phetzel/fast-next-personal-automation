import { AccordionContent, AccordionItem, AccordionTrigger, Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { CheckCircle, ExternalLink, XCircle } from "lucide-react";

interface MessageListItemProps {
  message: EmailMessage;
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString();
}

function ParserBadge({ parser }: { parser: string | null }) {
  if (!parser) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">
      {parser}
    </span>
  );
}

export function MessageListItem({ message }: MessageListItemProps) {
  return (
    <AccordionItem
      value={message.id}
      className={cn("bg-card rounded-lg border p-4 transition-all", "hover:shadow-md")}
    >
      <AccordionTrigger className="items-start hover:no-underline">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            {message.processing_error ? (
              <XCircle className="h-4 w-4 flex-shrink-0 text-red-500" />
            ) : (
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-green-500" />
            )}
            <p className="truncate font-medium">{message.subject || "(No subject)"}</p>
          </div>
          <p className="text-muted-foreground truncate text-sm">From: {message.from_address}</p>
        </div>
        <div className="ml-4 flex flex-shrink-0 items-center gap-4">
          <div className="text-right text-sm">
            <p className="text-muted-foreground">{formatDate(message.received_at)}</p>
            <div className="mt-1 flex items-center justify-end gap-2">
              <ParserBadge parser={message.parser_used} />
              <span className="text-muted-foreground">
                {message.jobs_extracted} job{message.jobs_extracted !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="border-t pt-4">
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
      </AccordionContent>
    </AccordionItem>
  );
}
