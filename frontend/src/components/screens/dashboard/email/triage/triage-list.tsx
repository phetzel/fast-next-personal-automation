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
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { formatDateTime } from "@/lib/formatters";
import type { EmailBucket, EmailSource, EmailTriageMessage } from "@/types";
import { AlertCircle, ExternalLink, Inbox } from "lucide-react";

const BUCKETS: Array<{ value: EmailBucket | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "now", label: "Now" },
  { value: "jobs", label: "Jobs" },
  { value: "finance", label: "Finance" },
  { value: "newsletter", label: "Newsletter" },
  { value: "notifications", label: "Notifications" },
  { value: "review", label: "Review" },
  { value: "done", label: "Done" },
];

const BUCKET_TONE: Record<EmailBucket, string> = {
  now: "bg-rose-500/10 text-rose-600",
  jobs: "bg-sky-500/10 text-sky-600",
  finance: "bg-emerald-500/10 text-emerald-600",
  newsletter: "bg-amber-500/10 text-amber-700",
  notifications: "bg-slate-500/10 text-slate-600",
  review: "bg-orange-500/10 text-orange-600",
  done: "bg-green-500/10 text-green-600",
};

interface TriageListProps {
  bucket: EmailBucket | "all";
  sourceId: string | "all";
  reviewOnly: boolean;
  unsubscribeOnly: boolean;
  sources: EmailSource[];
  messages: EmailTriageMessage[];
  isLoading: boolean;
  hasError: boolean;
  hasSources: boolean;
  onBucketChange: (bucket: EmailBucket | "all") => void;
  onSourceChange: (sourceId: string | "all") => void;
  onReviewOnlyChange: (value: boolean) => void;
  onUnsubscribeOnlyChange: (value: boolean) => void;
}

function ConfidenceBadge({ confidence }: { confidence: number | null }) {
  if (confidence === null || confidence === undefined) {
    return null;
  }

  return (
    <span className="bg-muted inline-flex rounded-full px-2 py-0.5 text-xs font-medium">
      {Math.round(confidence * 100)}%
    </span>
  );
}

export function TriageList({
  bucket,
  sourceId,
  reviewOnly,
  unsubscribeOnly,
  sources,
  messages,
  isLoading,
  hasError,
  hasSources,
  onBucketChange,
  onSourceChange,
  onReviewOnlyChange,
  onUnsubscribeOnlyChange,
}: TriageListProps) {
  const isFiltered = bucket !== "all" || sourceId !== "all" || reviewOnly || unsubscribeOnly;

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="space-y-4">
          <Tabs
            value={bucket}
            onValueChange={(value) => onBucketChange(value as EmailBucket | "all")}
          >
            <TabsList className="flex flex-wrap gap-2 border-b-0">
              {BUCKETS.map((item) => (
                <TabsTrigger
                  key={item.value}
                  value={item.value}
                  className="rounded-full border px-3 py-1.5 data-[state=active]:border-transparent"
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Select value={sourceId} onValueChange={onSourceChange}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="All sources" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sources</SelectItem>
                  {sources.map((source) => (
                    <SelectItem key={source.id} value={source.id}>
                      {source.email_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <label className="flex items-center gap-2 text-sm">
                <Switch checked={reviewOnly} onCheckedChange={onReviewOnlyChange} />
                Review only
              </label>

              <label className="flex items-center gap-2 text-sm">
                <Switch checked={unsubscribeOnly} onCheckedChange={onUnsubscribeOnlyChange} />
                Unsubscribe only
              </label>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !hasSources ? (
          <EmptyState
            icon={AlertCircle}
            title="No email sources connected"
            description="Connect Gmail in settings to start classifying your inbox."
          />
        ) : hasError ? (
          <EmptyState
            icon={AlertCircle}
            title="Could not load triage messages"
            description="Refresh the page or run triage again."
          />
        ) : messages.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={isFiltered ? "No messages match these filters" : "No triaged messages yet"}
            description={
              isFiltered
                ? "Try a different bucket or source filter."
                : "Run triage to classify recent Gmail messages into buckets."
            }
          />
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div key={message.id} className="rounded-xl border p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {message.bucket ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${BUCKET_TONE[message.bucket]}`}
                        >
                          {message.bucket}
                        </span>
                      ) : null}
                      <ConfidenceBadge confidence={message.triage_confidence} />
                      {message.requires_review ? (
                        <span className="inline-flex rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-medium text-orange-600">
                          review
                        </span>
                      ) : null}
                      {message.unsubscribe_candidate ? (
                        <span className="inline-flex rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                          unsubscribe
                        </span>
                      ) : null}
                    </div>
                    <div>
                      <p className="truncate font-semibold">{message.subject || "(No subject)"}</p>
                      <p className="text-muted-foreground truncate text-sm">
                        {message.from_address} · {message.source_email_address}
                      </p>
                    </div>
                    <p className="text-sm leading-6">
                      {message.summary || "No summary available."}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-start gap-2 text-sm lg:items-end">
                    <span className="text-muted-foreground">
                      {formatDateTime(message.received_at)}
                    </span>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={`https://mail.google.com/mail/u/0/#inbox/${message.gmail_message_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Gmail
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
