"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useConfirmDialog } from "@/components/shared/feedback";
import { StatusAlert } from "@/components/shared/feedback";
import {
  ConnectedAccountsCard,
  EmailSettingsHeader,
  HowItWorksCard,
  SupportedSourcesCard,
} from "@/components/screens/dashboard/settings/email";
import { apiClient } from "@/lib/api-client";
import { Card, Skeleton } from "@/components/ui";
import { Check, AlertCircle } from "lucide-react";
import type { EmailSource, EmailConfig, EmailSyncOutput } from "@/types";

export default function EmailSettingsPage() {
  const confirmDialog = useConfirmDialog();
  const searchParams = useSearchParams();
  const [sources, setSources] = useState<EmailSource[]>([]);
  const [config, setConfig] = useState<EmailConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

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

  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      // Call our frontend API route which will handle the auth token
      const response = await fetch("/api/email/connect");
      const data = await response.json();

      if (data.url) {
        // Redirect to the OAuth URL
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
        setConnecting(false);
      }
    } catch (err) {
      setError("Failed to initiate connection");
      setConnecting(false);
      console.error(err);
    }
  };

  const handleSync = async (sourceId: string) => {
    try {
      setSyncing(sourceId);
      setError(null);
      const result = await apiClient.post<EmailSyncOutput>(`/email/sources/${sourceId}/sync`);
      setSuccess(
        `Synced ${result.emails_processed} emails, extracted ${result.jobs_extracted} items, saved ${result.jobs_saved} new`
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
      setSources(sources.map((s) => (s.id === source.id ? { ...s, is_active: !s.is_active } : s)));
    } catch (err) {
      setError("Failed to update email source");
      console.error(err);
    }
  };

  const handleDelete = async (sourceId: string) => {
    const confirmed = await confirmDialog({
      title: "Disconnect email account?",
      description: "This will stop syncing the selected email account.",
      confirmLabel: "Disconnect",
      destructive: true,
    });
    if (!confirmed) {
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
        <EmailSettingsHeader />
        <Card className="p-6">
          <Skeleton className="h-24 w-full" />
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6">
      <EmailSettingsHeader />

      {error && (
        <StatusAlert icon={AlertCircle} variant="destructive">
          {error}
        </StatusAlert>
      )}

      {success && (
        <StatusAlert
          icon={Check}
          className="border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
        >
          {success}
        </StatusAlert>
      )}

      <ConnectedAccountsCard
        sources={sources}
        connecting={connecting}
        syncingSourceId={syncing}
        onConnect={handleConnect}
        onSync={handleSync}
        onToggle={handleToggle}
        onDelete={handleDelete}
        formatDate={formatDate}
      />

      {config && <SupportedSourcesCard config={config} />}

      <HowItWorksCard />
    </div>
  );
}
