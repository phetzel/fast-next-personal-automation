"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Button,
  Card,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@/components/ui";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import type { EmailSource, EmailSourceAutoActionSettings } from "@/types";
import { Loader2, Zap } from "lucide-react";

const THRESHOLD_OPTIONS = [
  { value: "0.8", label: "80% (more aggressive)" },
  { value: "0.85", label: "85%" },
  { value: "0.9", label: "90%" },
  { value: "0.95", label: "95% (recommended)" },
  { value: "1.0", label: "100% (only certain)" },
];

interface AutoActionsCardProps {
  sources: EmailSource[];
}

function SourceAutoActions({ source }: { source: EmailSource }) {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(source.auto_actions_enabled);
  const [threshold, setThreshold] = useState(source.auto_action_confidence_threshold);

  const mutation = useMutation({
    mutationFn: (settings: EmailSourceAutoActionSettings) =>
      apiClient.put<EmailSourceAutoActionSettings>(
        `/email/triage/sources/${source.id}/auto-actions`,
        settings
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.email.sources() });
      toast.success("Auto-action settings saved");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    },
  });

  const hasChanges =
    enabled !== source.auto_actions_enabled ||
    threshold !== source.auto_action_confidence_threshold;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium">{source.email_address}</p>
          <p className="text-muted-foreground text-sm">
            {enabled ? "Auto-actions enabled" : "Auto-actions disabled"}
          </p>
        </div>
        <Switch checked={enabled} onCheckedChange={setEnabled} />
      </div>

      {enabled && (
        <div className="space-y-2">
          <Label className="text-sm">Confidence threshold</Label>
          <Select
            value={String(threshold)}
            onValueChange={(value) => setThreshold(Number(value))}
          >
            <SelectTrigger className="w-full sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THRESHOLD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            Messages with confidence at or above this threshold will be auto-archived and labeled.
            VIP messages are always excluded.
          </p>
        </div>
      )}

      {hasChanges && (
        <Button
          size="sm"
          onClick={() =>
            mutation.mutate({
              auto_actions_enabled: enabled,
              auto_action_confidence_threshold: threshold,
            })
          }
          disabled={mutation.isPending}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save changes
        </Button>
      )}
    </div>
  );
}

export function AutoActionsCard({ sources }: AutoActionsCardProps) {
  if (sources.length === 0) {
    return null;
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-5 w-5" />
        <h2 className="text-lg font-semibold">Auto-Actions</h2>
      </div>
      <p className="text-muted-foreground mb-4 text-sm">
        When enabled, high-confidence messages are automatically archived, labeled, and marked as
        read during triage runs. Notifications are only marked as read. VIP messages are never
        auto-actioned. Trash requires an explicit sender rule.
      </p>
      <div className="space-y-4">
        {sources.map((source) => (
          <SourceAutoActions key={source.id} source={source} />
        ))}
      </div>
    </Card>
  );
}
