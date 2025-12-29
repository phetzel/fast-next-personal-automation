"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { Button, Card, Badge } from "@/components/ui";
import {
  Mail,
  RefreshCw,
  Trash2,
  Check,
  AlertCircle,
  Clock,
  ExternalLink,
  Loader2,
  Inbox,
  Briefcase,
} from "lucide-react";
import type { EmailSource, EmailConfig, EmailSyncOutput } from "@/types";

// Simple alert component using existing Card styles
function Alert({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: "default" | "destructive";
  className?: string;
}) {
  const baseStyles = "flex items-start gap-3 rounded-lg border p-4";
  const variantStyles =
    variant === "destructive"
      ? "border-destructive/50 bg-destructive/10"
      : className;
  return <div className={`${baseStyles} ${variantStyles}`}>{children}</div>;
}

// Simple skeleton component
function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-muted ${className}`} />
  );
}

export default function EmailSettingsPage() {
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<EmailSource[]>([]);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Check for success/error from OAuth callback
  useEffect(() => {
    const successMsg = searchParams.get("success");
    const errorMsg = searchParams.get("error");
    if (successMsg) {
      setSuccess(successMsg);
      // Clear URL params after displaying
      window.history.replaceState({}, "", "/settings/email");
    }
    if (errorMsg) {
      setError(errorMsg);
      window.history.replaceState({}, "", "/settings/email");
    }
  }, [searchParams]);

  // Fetch email sources and config
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [sourcesData, configData] = await Promise.all([
          apiClient.get<EmailSource[]>("/email/sources"),
          apiClient.get<EmailConfig>("/email/config"),
        ]);
        setSources(sourcesData);
        setConfig(configData);
      } catch (err) {
        setError("Failed to load email settings");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConnect = () => {
    // Redirect to backend OAuth endpoint
    window.location.href = `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/api/v1/email/gmail/connect`;
  };

  const handleSync = async (sourceId: string) => {
    try {
      setSyncing(sourceId);
      setError(null);
      const result = await apiClient.post<EmailSyncOutput>(
        `/email/sources/${sourceId}/sync`
      );
      setSuccess(
        `Synced ${result.emails_processed} emails, extracted ${result.jobs_extracted} jobs, saved ${result.jobs_saved} new jobs`
      );

      // Refresh sources to update last_sync_at
      const updatedSources = await apiClient.get<EmailSource[]>("/email/sources");
      setSources(updatedSources);
    } catch (err) {
      setError("Failed to sync email source");
      console.error(err);
    } finally {
      setSyncing(null);
    }
  };

  const handleToggle = async (source: EmailSource) => {
    try {
      await apiClient.patch(`/email/sources/${source.id}`, {
        is_active: !source.is_active,
      });

      // Update local state
      setSources(
        sources.map((s) =>
          s.id === source.id ? { ...s, is_active: !s.is_active } : s
        )
      );
    } catch (err) {
      setError("Failed to update email source");
      console.error(err);
    }
  };

  const handleDelete = async (sourceId: string) => {
    if (!confirm("Are you sure you want to disconnect this email account?")) {
      return;
    }

    try {
      await apiClient.delete(`/email/sources/${sourceId}`);
      setSources(sources.filter((s) => s.id !== sourceId));
      setSuccess("Email account disconnected");
    } catch (err) {
      setError("Failed to disconnect email source");
      console.error(err);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {
    return (
      <div className="container mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Email Integration
          </h1>
          <p className="text-muted-foreground">
            Connect your email to automatically import job alerts
          </p>
        </div>
        <Card className="p-6">
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Email Integration
        </h1>
        <p className="text-muted-foreground">
          Connect your email to automatically import job alerts from Indeed,
          LinkedIn, HiringCafe, and more
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <Check className="h-4 w-4 shrink-0 text-green-600" />
          <p className="text-sm text-green-700 dark:text-green-300">
            {success}
          </p>
        </Alert>
      )}

      {/* Connected Accounts */}
      <Card className="p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connected Accounts</h2>
          <Button onClick={handleConnect} className="gap-2">
            <Mail className="h-4 w-4" />
            Connect Gmail
          </Button>
        </div>

        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Inbox className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="mb-2 text-lg font-medium">No email accounts connected</p>
            <p className="mb-4 text-sm text-muted-foreground">
              Connect your Gmail to automatically sync job alerts
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
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{source.email_address}</span>
                      <Badge variant={source.is_active ? "default" : "secondary"}>
                        {source.is_active ? "Active" : "Paused"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      Last sync: {formatDate(source.last_sync_at)}
                    </div>
                    {source.last_sync_error && (
                      <p className="mt-1 text-sm text-destructive">
                        {source.last_sync_error}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleSync(source.id)}
                    disabled={syncing === source.id || !source.is_active}
                  >
                    {syncing === source.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="h-4 w-4" />
                    )}
                    <span className="ml-2">Sync Now</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(source)}
                  >
                    {source.is_active ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(source.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Supported Job Boards */}
      {config && (
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Supported Job Boards</h2>
          <p className="mb-4 text-sm text-muted-foreground">
            Emails from these job boards will be automatically parsed every{" "}
            {config.sync_interval_minutes} minutes
          </p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {config.default_senders.map((sender) => (
              <div
                key={sender.domain}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <Briefcase className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium">{sender.display_name}</span>
                  <p className="text-xs text-muted-foreground">{sender.domain}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* How It Works */}
      <Card className="p-6">
        <h2 className="mb-4 text-lg font-semibold">How It Works</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              1
            </div>
            <div>
              <p className="font-medium">Connect your Gmail</p>
              <p className="text-sm text-muted-foreground">
                We only request read-only access to fetch job alert emails
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              2
            </div>
            <div>
              <p className="font-medium">Automatic syncing</p>
              <p className="text-sm text-muted-foreground">
                Every 15 minutes, we check for new job alert emails from supported
                job boards
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              3
            </div>
            <div>
              <p className="font-medium">Jobs added to your list</p>
              <p className="text-sm text-muted-foreground">
                Job listings are extracted and added to your Jobs list for review
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Privacy Note */}
      <Card className="border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
        <div className="flex items-start gap-3">
          <ExternalLink className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
          <div>
            <p className="font-medium text-blue-900 dark:text-blue-100">
              Privacy Note
            </p>
            <p className="text-sm text-blue-700 dark:text-blue-300">
              We only access emails from specific job board senders. Your personal
              emails are never read or stored. You can disconnect at any time.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

