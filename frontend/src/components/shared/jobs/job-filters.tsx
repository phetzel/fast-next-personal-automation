"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui";
import { cn } from "@/lib/utils";
import type { JobFilters, JobStatus, IngestionSource } from "@/types";
import { JOB_STATUSES, JOB_STATUS_CONFIG } from "@/types";
import { Search, X, Filter } from "lucide-react";

interface JobFiltersProps {
  filters: JobFilters;
  onFiltersChange: (filters: Partial<JobFilters>) => void;
  onReset: () => void;
  className?: string;
}

// Generate status options from the shared constant
const STATUS_OPTIONS: { value: JobStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  ...JOB_STATUSES.map((status) => ({
    value: status,
    label: JOB_STATUS_CONFIG[status].label,
  })),
];

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

  useEffect(() => {
    setSearchValue(filters.search || "");
  }, [filters.search]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ search: searchValue || undefined, page: 1 });
  };

  const handleStatusChange = (value: JobStatus | "all") => {
    onFiltersChange({
      status: value === "all" ? undefined : value,
      page: 1,
    });
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
    filters.status ||
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

        {/* Status filter */}
        <Select
          value={filters.status || "all"}
          onValueChange={(value) => handleStatusChange(value as JobStatus | "all")}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

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
