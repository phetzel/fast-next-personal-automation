"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch } from "@/components/ui";
import type { EmailBucket, EmailDestination, EmailDestinationInput } from "@/types";
import { Pencil, Plus, Trash2 } from "lucide-react";

const BUCKET_OPTIONS: Array<EmailBucket | "none"> = [
  "none",
  "now",
  "jobs",
  "finance",
  "newsletter",
  "notifications",
  "review",
  "done",
];

interface SenderRulesCardProps {
  senderRules: EmailDestination[];
  isSaving: boolean;
  onCreateRule: (input: EmailDestinationInput) => Promise<boolean>;
  onUpdateRule: (id: string, input: Partial<EmailDestinationInput>) => Promise<boolean>;
  onDeleteRule: (id: string) => Promise<boolean>;
  onToggleRule: (rule: EmailDestination) => Promise<boolean>;
}

interface SenderRuleFormState {
  pattern: string;
  isActive: boolean;
  alwaysKeep: boolean;
  queueUnsubscribe: boolean;
  suggestArchive: boolean;
  bucketOverride: EmailBucket | "none";
}

const DEFAULT_FORM: SenderRuleFormState = {
  pattern: "",
  isActive: true,
  alwaysKeep: false,
  queueUnsubscribe: true,
  suggestArchive: true,
  bucketOverride: "none",
};

function getPattern(rule: EmailDestination) {
  return rule.filter_rules?.sender_patterns?.[0] ?? "";
}

function buildPayload(state: SenderRuleFormState): EmailDestinationInput {
  const alwaysKeep = state.alwaysKeep;
  return {
    name: `Cleanup: ${state.pattern.trim()}`,
    destination_type: "cleanup",
    filter_rules: {
      sender_patterns: [state.pattern.trim()],
      subject_contains: [],
      subject_not_contains: [],
    },
    parser_name: null,
    is_active: state.isActive,
    priority: 100,
    always_keep: alwaysKeep,
    queue_unsubscribe: alwaysKeep ? false : state.queueUnsubscribe,
    suggest_archive: alwaysKeep ? false : state.suggestArchive,
    bucket_override: state.bucketOverride === "none" ? null : state.bucketOverride,
  };
}

export function SenderRulesCard({
  senderRules,
  isSaving,
  onCreateRule,
  onUpdateRule,
  onDeleteRule,
  onToggleRule,
}: SenderRulesCardProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [form, setForm] = useState<SenderRuleFormState>(DEFAULT_FORM);

  useEffect(() => {
    if (!editingRuleId) {
      setForm(DEFAULT_FORM);
      return;
    }

    const rule = senderRules.find((item) => item.id === editingRuleId);
    if (!rule) {
      setEditingRuleId(null);
      setForm(DEFAULT_FORM);
      return;
    }

    setForm({
      pattern: getPattern(rule),
      isActive: rule.is_active,
      alwaysKeep: rule.always_keep,
      queueUnsubscribe: rule.queue_unsubscribe,
      suggestArchive: rule.suggest_archive,
      bucketOverride: rule.bucket_override ?? "none",
    });
  }, [editingRuleId, senderRules]);

  const handleSubmit = async () => {
    if (!form.pattern.trim()) {
      return;
    }

    const payload = buildPayload(form);
    const ok = editingRuleId
      ? await onUpdateRule(editingRuleId, payload)
      : await onCreateRule(payload);

    if (ok) {
      setEditingRuleId(null);
      setForm(DEFAULT_FORM);
    }
  };

  return (
    <Card className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Sender Rules</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage cleanup rules for senders you always keep, archive, or route into a specific bucket.
          </p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
        <div className="space-y-3">
          <Input
            placeholder="newsletter.example.com"
            value={form.pattern}
            onChange={(event) => setForm((current) => ({ ...current, pattern: event.target.value }))}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Rule active</span>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Always keep</span>
              <Switch
                checked={form.alwaysKeep}
                onCheckedChange={(checked) =>
                  setForm((current) => ({
                    ...current,
                    alwaysKeep: checked,
                    queueUnsubscribe: checked ? false : current.queueUnsubscribe,
                    suggestArchive: checked ? false : current.suggestArchive,
                  }))
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Queue unsubscribe</span>
              <Switch
                checked={form.queueUnsubscribe}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, queueUnsubscribe: checked, alwaysKeep: false }))
                }
              />
            </label>
            <label className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
              <span>Suggest archive</span>
              <Switch
                checked={form.suggestArchive}
                onCheckedChange={(checked) =>
                  setForm((current) => ({ ...current, suggestArchive: checked, alwaysKeep: false }))
                }
              />
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <Select
            value={form.bucketOverride}
            onValueChange={(value) =>
              setForm((current) => ({ ...current, bucketOverride: value as EmailBucket | "none" }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Bucket override" />
            </SelectTrigger>
            <SelectContent>
              {BUCKET_OPTIONS.map((bucket) => (
                <SelectItem key={bucket} value={bucket}>
                  {bucket === "none" ? "No bucket override" : bucket}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSubmit} disabled={isSaving || !form.pattern.trim()}>
              <Plus className="mr-2 h-4 w-4" />
              {editingRuleId ? "Save Rule" : "Create Rule"}
            </Button>
            {editingRuleId ? (
              <Button variant="outline" onClick={() => setEditingRuleId(null)}>
                Cancel
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {senderRules.length === 0 ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-4 text-sm">
            No sender rules yet. Approve a sender from the subscriptions queue or add one manually here.
          </div>
        ) : (
          senderRules.map((rule) => (
            <div
              key={rule.id}
              className="flex flex-col gap-3 rounded-lg border p-4 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{getPattern(rule) || rule.name}</p>
                  <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium">
                    {rule.is_active ? "Active" : "Paused"}
                  </span>
                  {rule.always_keep ? (
                    <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-700">
                      always keep
                    </span>
                  ) : null}
                  {rule.queue_unsubscribe ? (
                    <span className="rounded-full bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-700">
                      unsubscribe
                    </span>
                  ) : null}
                  {rule.suggest_archive ? (
                    <span className="rounded-full bg-sky-500/10 px-2 py-1 text-xs font-medium text-sky-700">
                      archive
                    </span>
                  ) : null}
                  {rule.bucket_override ? (
                    <span className="rounded-full bg-orange-500/10 px-2 py-1 text-xs font-medium text-orange-700">
                      {rule.bucket_override}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditingRuleId(rule.id)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" size="sm" onClick={() => onToggleRule(rule)}>
                  {rule.is_active ? "Pause" : "Resume"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => onDeleteRule(rule.id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
