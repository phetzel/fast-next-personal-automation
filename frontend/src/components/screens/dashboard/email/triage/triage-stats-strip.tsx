import { Card } from "@/components/ui";
import type { EmailBucket, EmailTriageStats } from "@/types";

const BUCKET_ORDER: EmailBucket[] = [
  "now",
  "jobs",
  "finance",
  "newsletter",
  "notifications",
  "review",
  "done",
];

interface TriageStatsStripProps {
  stats: EmailTriageStats | null;
}

export function TriageStatsStrip({ stats }: TriageStatsStripProps) {
  if (!stats) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">Total triaged</p>
        <p className="mt-1 text-2xl font-semibold">{stats.total_triaged}</p>
      </Card>
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">Needs review</p>
        <p className="mt-1 text-2xl font-semibold">{stats.review_count}</p>
      </Card>
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">Unsubscribe candidates</p>
        <p className="mt-1 text-2xl font-semibold">{stats.unsubscribe_count}</p>
      </Card>
      <Card className="p-4">
        <p className="text-muted-foreground text-sm">Buckets</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {BUCKET_ORDER.map((bucket) => (
            <span
              key={bucket}
              className="bg-muted inline-flex rounded-full px-2.5 py-1 text-xs font-medium"
            >
              {bucket}: {stats.by_bucket[bucket] ?? 0}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
