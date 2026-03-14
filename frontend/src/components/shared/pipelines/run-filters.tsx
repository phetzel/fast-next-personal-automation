"use client";

import { useState } from "react";
import {
  Button,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import type {
  PipelineRunFilters,
  PipelineRunStatus,
  PipelineTriggerType,
  PipelineInfo,
} from "@/types";
import { Filter, X, RotateCcw } from "lucide-react";

interface RunFiltersProps {
  filters: PipelineRunFilters;
  pipelines: PipelineInfo[];
  onFilterChange: (filters: Partial<PipelineRunFilters>) => void;
  onReset: () => void;
}

const statusOptions: { value: PipelineRunStatus; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "error", label: "Error" },
  { value: "running", label: "Running" },
  { value: "pending", label: "Pending" },
  { value: "cancelled", label: "Cancelled" },
];

const triggerOptions: { value: PipelineTriggerType; label: string }[] = [
  { value: "api", label: "API" },
  { value: "webhook", label: "Webhook" },
  { value: "agent", label: "Agent" },
  { value: "cron", label: "Scheduled" },
  { value: "manual", label: "Manual" },
];

const ALL_PIPELINES_VALUE = "__all_pipelines__";
const ALL_STATUSES_VALUE = "__all_statuses__";
const ALL_TRIGGERS_VALUE = "__all_triggers__";

export function RunFilters({ filters, pipelines, onFilterChange, onReset }: RunFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasActiveFilters =
    filters.pipeline_name ||
    filters.status ||
    filters.trigger_type ||
    filters.success_only ||
    filters.error_only ||
    filters.my_runs_only;

  const activeFilterCount = [
    filters.pipeline_name,
    filters.status,
    filters.trigger_type,
    filters.success_only,
    filters.error_only,
    filters.my_runs_only,
  ].filter(Boolean).length;

  return (
    <div className="bg-card space-y-4 rounded-lg border p-4">
      {/* Filter toggle header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium"
        >
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs">
              {activeFilterCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground h-8 gap-1.5 text-xs"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </Button>
        )}
      </div>

      {/* Expanded filters */}
      {isExpanded && (
        <div className="grid gap-4 pt-2 sm:grid-cols-2 lg:grid-cols-4">
          {/* Pipeline filter */}
          <div className="space-y-2">
            <Label className="text-xs">Pipeline</Label>
            <Select
              value={filters.pipeline_name || ALL_PIPELINES_VALUE}
              onValueChange={(value) =>
                onFilterChange({
                  pipeline_name: value === ALL_PIPELINES_VALUE ? undefined : value,
                })
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PIPELINES_VALUE}>All pipelines</SelectItem>
                {pipelines.map((p) => (
                  <SelectItem key={p.name} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-2">
            <Label className="text-xs">Status</Label>
            <Select
              value={filters.status || ALL_STATUSES_VALUE}
              onValueChange={(value) =>
                onFilterChange({
                  status: value === ALL_STATUSES_VALUE ? undefined : (value as PipelineRunStatus),
                })
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_STATUSES_VALUE}>All statuses</SelectItem>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Trigger filter */}
          <div className="space-y-2">
            <Label className="text-xs">Trigger</Label>
            <Select
              value={filters.trigger_type || ALL_TRIGGERS_VALUE}
              onValueChange={(value) =>
                onFilterChange({
                  trigger_type:
                    value === ALL_TRIGGERS_VALUE ? undefined : (value as PipelineTriggerType),
                })
              }
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_TRIGGERS_VALUE}>All triggers</SelectItem>
                {triggerOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick filters */}
          <div className="space-y-2">
            <Label className="text-xs">Quick Filters</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filters.my_runs_only ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => onFilterChange({ my_runs_only: !filters.my_runs_only })}
              >
                My Runs
              </Button>
              <Button
                variant={filters.error_only ? "destructive" : "outline"}
                size="sm"
                className="h-8 text-xs"
                onClick={() =>
                  onFilterChange({ error_only: !filters.error_only, success_only: false })
                }
              >
                Errors Only
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Active filter chips (shown when collapsed) */}
      {!isExpanded && hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.pipeline_name && (
            <FilterChip
              label={`Pipeline: ${filters.pipeline_name}`}
              onRemove={() => onFilterChange({ pipeline_name: undefined })}
            />
          )}
          {filters.status && (
            <FilterChip
              label={`Status: ${filters.status}`}
              onRemove={() => onFilterChange({ status: undefined })}
            />
          )}
          {filters.trigger_type && (
            <FilterChip
              label={`Trigger: ${filters.trigger_type}`}
              onRemove={() => onFilterChange({ trigger_type: undefined })}
            />
          )}
          {filters.my_runs_only && (
            <FilterChip label="My Runs" onRemove={() => onFilterChange({ my_runs_only: false })} />
          )}
          {filters.error_only && (
            <FilterChip
              label="Errors Only"
              onRemove={() => onFilterChange({ error_only: false })}
            />
          )}
        </div>
      )}
    </div>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium">
      {label}
      <button onClick={onRemove} className="hover:bg-secondary-foreground/20 rounded-full p-0.5">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}
