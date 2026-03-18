"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { JobFilters, JobStatus, IngestionSource } from "@/types";
import {
  DEFAULT_JOB_STATUS_FILTERS,
  JOB_STATUSES,
  JOB_STATUS_CONFIG,
  POST_APPLIED_JOB_STATUSES,
  PRE_APPLIED_JOB_STATUSES,
} from "@/types";
import { Search, X, Filter, ChevronDown } from "lucide-react";
import { getNextSelectedStatuses } from "./job-filter-utils";

interface JobFiltersProps {
  filters: JobFilters;
  onFiltersChange: (filters: Partial<JobFilters>) => void;
  onReset: () => void;
  className?: string;
}

const PRE_APPLIED_STATUS_OPTIONS = PRE_APPLIED_JOB_STATUSES.map((status) => ({
  value: status,
  label: JOB_STATUS_CONFIG[status].label,
}));

const POST_APPLIED_STATUS_OPTIONS = POST_APPLIED_JOB_STATUSES.map((status) => ({
  value: status,
  label: JOB_STATUS_CONFIG[status].label,
}));

const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: "created_at:desc", label: "Newest First" },
  { value: "created_at:asc", label: "Oldest First" },
  { value: "relevance_score:desc", label: "Highest Score" },
  { value: "relevance_score:asc", label: "Lowest Score" },
  { value: "company:asc", label: "Company A-Z" },
  { value: "date_posted:desc", label: "Recently Posted" },
];

const RECENCY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "Any Time" },
  { value: "24", label: "Last 24 Hours" },
  { value: "48", label: "Last 48 Hours" },
  { value: "72", label: "Last 3 Days" },
  { value: "168", label: "Last Week" },
];

const INGESTION_SOURCE_OPTIONS: { value: IngestionSource | "all"; label: string }[] = [
  { value: "all", label: "All Sources" },
  { value: "scrape", label: "Scraped" },
  { value: "email", label: "From Email" },
  { value: "openclaw", label: "OpenClaw" },
  { value: "manual", label: "Manual" },
];

export function JobFilters({ filters, onFiltersChange, onReset, className }: JobFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || "");
  const selectedStatuses = useMemo(() => {
    if (filters.statuses !== undefined) {
      return JOB_STATUSES.filter((status) => filters.statuses?.includes(status));
    }

    if (filters.status) {
      return [filters.status];
    }

    return DEFAULT_JOB_STATUS_FILTERS;
  }, [filters.status, filters.statuses]);
  const allStatusesSelected = selectedStatuses.length === JOB_STATUSES.length;
  const isDefaultStatusSelection =
    selectedStatuses.length === DEFAULT_JOB_STATUS_FILTERS.length &&
    selectedStatuses.every((status, index) => status === DEFAULT_JOB_STATUS_FILTERS[index]);
  const statusLabel = useMemo(() => {
    if (isDefaultStatusSelection) {
      return "Pre-applied";
    }

    if (allStatusesSelected) {
      return "All statuses";
    }

    if (selectedStatuses.length === 0) {
      return "No statuses";
    }

    if (selectedStatuses.length === 1) {
      return JOB_STATUS_CONFIG[selectedStatuses[0]].label;
    }

    return `${selectedStatuses.length} statuses`;
  }, [allStatusesSelected, isDefaultStatusSelection, selectedStatuses]);

  useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ search: searchValue || undefined, page: 1 });
  };

  const handleStatusesChange = (statuses: JobStatus[]) => {
    onFiltersChange({
      status: undefined,
      statuses,
      page: 1,
    });
  };

  const toggleStatus = (status: JobStatus) => {
    handleStatusesChange(getNextSelectedStatuses(selectedStatuses, status));
  };

  const handleSortChange = (value: string) => {
    const [sort_by, sort_order] = value.split(":") as [
      JobFilters["sort_by"],
      JobFilters["sort_order"],
    ];
    onFiltersChange({ sort_by, sort_order, page: 1 });
  };

  const handleRecencyChange = (value: string) => {
    onFiltersChange({
      posted_within_hours: value === "all" ? undefined : parseInt(value, 10),
      page: 1,
    });
  };

  const handleIngestionSourceChange = (value: IngestionSource | "all") => {
    onFiltersChange({
      ingestion_source: value === "all" ? undefined : value,
      page: 1,
    });
  };

  const hasActiveFilters =
    !isDefaultStatusSelection ||
    filters.search ||
    filters.min_score !== undefined ||
    filters.max_score !== undefined ||
    filters.posted_within_hours !== undefined ||
    filters.ingestion_source !== undefined;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search jobs..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pr-9 pl-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                onFiltersChange({ search: undefined, page: 1 });
              }}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="min-w-[180px] justify-between">
              <span className="truncate">Status: {statusLabel}</span>
              <ChevronDown className="ml-2 h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Quick Filters</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => handleStatusesChange(DEFAULT_JOB_STATUS_FILTERS)}>
              Pre-applied only
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleStatusesChange([...JOB_STATUSES])}>
              All jobs
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Pre-applied</DropdownMenuLabel>
            {PRE_APPLIED_STATUS_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selectedStatuses.includes(option.value)}
                onCheckedChange={() => toggleStatus(option.value)}
                onSelect={(event) => event.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Post-applied</DropdownMenuLabel>
            {POST_APPLIED_STATUS_OPTIONS.map((option) => (
              <DropdownMenuCheckboxItem
                key={option.value}
                checked={selectedStatuses.includes(option.value)}
                onCheckedChange={() => toggleStatus(option.value)}
                onSelect={(event) => event.preventDefault()}
              >
                {option.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Recency filter */}
        <Select
          value={filters.posted_within_hours?.toString() || "all"}
          onValueChange={handleRecencyChange}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {RECENCY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Ingestion source filter */}
        <Select
          value={filters.ingestion_source || "all"}
          onValueChange={(value) => handleIngestionSourceChange(value as IngestionSource | "all")}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {INGESTION_SOURCE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Sort */}
        <Select
          value={`${filters.sort_by || "created_at"}:${filters.sort_order || "desc"}`}
          onValueChange={handleSortChange}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset */}
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="text-muted-foreground flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4" />
          <span>Filters active</span>
        </div>
      )}
    </div>
  );
}
