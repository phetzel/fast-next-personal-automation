import { Button, Card } from "@/components/ui";
import type { EmailSource } from "@/types";
import { Clock, Inbox, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";

interface ConnectedAccountsCardProps {
  sources: EmailSource[];
  connecting: boolean;
  syncingSourceId: string | null;
  onConnect: () => void;
  onSync: (sourceId: string) => void;
  onToggle: (source: EmailSource) => void;
  onDelete: (sourceId: string) => void;
  formatDate: (dateStr: string | null) => string;
}

export function ConnectedAccountsCard({
  sources,
  connecting,
  syncingSourceId,
  onConnect,
  onSync,
  onToggle,
  onDelete,
  formatDate,
}: ConnectedAccountsCardProps) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Connected Accounts</h2>
        <Button onClick={onConnect} className="gap-2" disabled={connecting}>
          {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          Connect Gmail
        </Button>
      </div>

      {sources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Inbox className="text-muted-foreground mb-4 h-12 w-12" />
          <p className="mb-2 text-lg font-medium">No email accounts connected</p>
          <p className="text-muted-foreground mb-4 text-sm">
            Connect your Gmail to automatically sync emails
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {sources.map((source) => (
            <div
              key={source.id}
              className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-full">
                  <Mail className="text-primary h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{source.email_address}</span>
                    <span
                      className={
                        source.is_active
                          ? "bg-primary text-primary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                          : "bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                      }
                    >
                      {source.is_active ? "Active" : "Paused"}
                    </span>
                  </div>
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Clock className="h-3 w-3" />
                    Last sync: {formatDate(source.last_sync_at)}
                  </div>
                  {source.last_sync_error && (
                    <p className="text-destructive mt-1 text-sm">{source.last_sync_error}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onSync(source.id)}
                  disabled={syncingSourceId === source.id || !source.is_active}
                >
                  {syncingSourceId === source.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2">Sync Now</span>
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onToggle(source)}>
                  {source.is_active ? "Pause" : "Resume"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => onDelete(source.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
