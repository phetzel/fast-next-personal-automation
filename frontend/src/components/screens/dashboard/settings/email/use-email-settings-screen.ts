"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useConfirmDialog } from "@/components/shared/feedback";
import { useEnsureEmailTriageSchedule } from "@/hooks/use-email-triage-schedule-bootstrap";
import {
  useCreateEmailDestinationMutation,
  useDeleteEmailDestinationMutation,
  useEmailConfigQuery,
  useEmailDestinationsQuery,
  useEmailSourcesQuery,
  useUpdateEmailDestinationMutation,
} from "@/hooks/queries/email";
import { apiClient } from "@/lib/api-client";
import { formatDateTime } from "@/lib/formatters";
import { queryKeys } from "@/lib/query-keys";
import type {
  EmailConfig,
  EmailDestination,
  EmailDestinationInput,
  EmailSource,
  EmailSyncOutput,
} from "@/types";

export function useEmailSettingsScreen() {
  const confirmDialog = useConfirmDialog();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const [connecting, setConnecting] = useState(false);
  const [syncingSourceId, setSyncingSourceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sourcesQuery = useEmailSourcesQuery();
  const configQuery = useEmailConfigQuery();
  const senderRulesQuery = useEmailDestinationsQuery("cleanup");
  useEnsureEmailTriageSchedule(sourcesQuery.data ?? []);

  useEffect(() => {
    const successMessage = searchParams.get("success");
    const errorMessage = searchParams.get("error");

    if (successMessage) {
      setSuccess(successMessage);
      window.history.replaceState({}, "", "/settings/email");
    }

    if (errorMessage) {
      setError(errorMessage);
      window.history.replaceState({}, "", "/settings/email");
    }
  }, [searchParams]);

  const syncMutation = useMutation({
    mutationFn: (sourceId: string) =>
      apiClient.post<EmailSyncOutput>(`/email/sources/${sourceId}/sync`),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
      const message = `Synced ${result.emails_processed} emails, extracted ${result.jobs_extracted} items, saved ${result.jobs_saved} new`;
      setSuccess(message);
      toast.success("Email sync complete");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Failed to sync email source";
      setError(message);
      toast.error(message);
    },
    onSettled: () => {
      setSyncingSourceId(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ sourceId, isActive }: { sourceId: string; isActive: boolean }) =>
      apiClient.patch(`/email/sources/${sourceId}`, { is_active: isActive }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.email.sources() });
      toast.success("Email source updated");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error ? mutationError.message : "Failed to update email source";
      setError(message);
      toast.error(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => apiClient.delete(`/email/sources/${sourceId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
      setSuccess("Email account disconnected");
      toast.success("Email account disconnected");
    },
    onError: (mutationError) => {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : "Failed to disconnect email source";
      setError(message);
      toast.error(message);
    },
  });

  const createRuleMutation = useCreateEmailDestinationMutation();
  const updateRuleMutation = useUpdateEmailDestinationMutation();
  const deleteRuleMutation = useDeleteEmailDestinationMutation();

  return {
    sources: sourcesQuery.data ?? [],
    config: (configQuery.data ?? null) as EmailConfig | null,
    senderRules: senderRulesQuery.data ?? [],
    loading:
      sourcesQuery.isLoading ||
      sourcesQuery.isFetching ||
      configQuery.isLoading ||
      configQuery.isFetching ||
      senderRulesQuery.isLoading ||
      senderRulesQuery.isFetching,
    senderRulesSaving:
      createRuleMutation.isPending || updateRuleMutation.isPending || deleteRuleMutation.isPending,
    connecting,
    syncingSourceId,
    error:
      error ??
      (sourcesQuery.error instanceof Error
        ? sourcesQuery.error.message
        : configQuery.error instanceof Error
          ? configQuery.error.message
          : senderRulesQuery.error instanceof Error
            ? senderRulesQuery.error.message
          : null),
    success,
    formatDate: (value: string | null) => (value ? formatDateTime(value) : "Never"),
    onConnect: async () => {
      try {
        setConnecting(true);
        setError(null);
        const response = await fetch("/api/email/connect");
        const data = await response.json();

        if (data.url) {
          window.location.href = data.url;
          return;
        }

        if (data.error) {
          setError(data.error);
          toast.error(data.error);
        }
      } catch (connectError) {
        const message =
          connectError instanceof Error ? connectError.message : "Failed to initiate connection";
        setError(message);
        toast.error(message);
      } finally {
        setConnecting(false);
      }
    },
    onSync: async (sourceId: string) => {
      setError(null);
      setSyncingSourceId(sourceId);
      try {
        return await syncMutation.mutateAsync(sourceId);
      } catch {
        return null;
      }
    },
    onToggle: async (source: EmailSource) => {
      setError(null);
      try {
        await toggleMutation.mutateAsync({ sourceId: source.id, isActive: !source.is_active });
      } catch {
        return null;
      }
    },
    onDelete: async (sourceId: string) => {
      const confirmed = await confirmDialog({
        title: "Disconnect email account?",
        description: "This will stop syncing the selected email account.",
        confirmLabel: "Disconnect",
        destructive: true,
      });

      if (!confirmed) {
        return false;
      }

      setError(null);
      try {
        await deleteMutation.mutateAsync(sourceId);
        return true;
      } catch {
        return false;
      }
    },
    onCreateSenderRule: async (input: EmailDestinationInput) => {
      setError(null);
      try {
        await createRuleMutation.mutateAsync(input);
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success("Sender rule created");
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to create sender rule";
        setError(message);
        toast.error(message);
        return false;
      }
    },
    onUpdateSenderRule: async (id: string, input: Partial<EmailDestinationInput>) => {
      setError(null);
      try {
        await updateRuleMutation.mutateAsync({ id, input });
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success("Sender rule updated");
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to update sender rule";
        setError(message);
        toast.error(message);
        return false;
      }
    },
    onToggleSenderRule: async (rule: EmailDestination) => {
      setError(null);
      try {
        await updateRuleMutation.mutateAsync({
          id: rule.id,
          input: { is_active: !rule.is_active },
        });
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success(rule.is_active ? "Sender rule paused" : "Sender rule resumed");
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to update sender rule";
        setError(message);
        toast.error(message);
        return false;
      }
    },
    onDeleteSenderRule: async (id: string) => {
      const confirmed = await confirmDialog({
        title: "Delete sender rule?",
        description:
          "This removes the cleanup rule and future messages from this sender may reappear in review queues.",
        confirmLabel: "Delete",
        destructive: true,
      });

      if (!confirmed) {
        return false;
      }

      setError(null);
      try {
        await deleteRuleMutation.mutateAsync(id);
        await queryClient.invalidateQueries({ queryKey: queryKeys.email.all });
        toast.success("Sender rule deleted");
        return true;
      } catch (mutationError) {
        const message =
          mutationError instanceof Error ? mutationError.message : "Failed to delete sender rule";
        setError(message);
        toast.error(message);
        return false;
      }
    },
  };
}
