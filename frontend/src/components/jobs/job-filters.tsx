"use client";

import { Button, Input } from "@/components/ui";
import type { JobFilters, JobStatus, IngestionSource } from "@/types";
import { JOB_STATUSES, JOB_STATUS_CONFIG } from "@/types";
import { cn } from "@/lib/utils";
import { Search, X, Filter } from "lucide-react";
import { useState } from "react";

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
  { value: "manual", label: "Manual" },
];

export function JobFilters({ filters, onFiltersChange, onReset, className }: JobFiltersProps) {
  const [searchValue, setSearchValue] = useState(filters.search || "");

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onFiltersChange({ search: searchValue || undefined, page: 1 });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as JobStatus | "all";
    onFiltersChange({
      status: value === "all" ? undefined : value,
      page: 1,
    });
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [sort_by, sort_order] = e.target.value.split(":") as [
      JobFilters["sort_by"],
      JobFilters["sort_order"],
    ];
    onFiltersChange({ sort_by, sort_order, page: 1 });
  };

  const handleRecencyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    onFiltersChange({
      posted_within_hours: value === "all" ? undefined : parseInt(value, 10),
      page: 1,
    });
  };

  const handleIngestionSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as IngestionSource | "all";
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
        <select
          value={filters.status || "all"}
          onChange={handleStatusChange}
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Recency filter */}
        <select
          value={filters.posted_within_hours?.toString() || "all"}
          onChange={handleRecencyChange}
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          {RECENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Ingestion source filter */}
        <select
          value={filters.ingestion_source || "all"}
          onChange={handleIngestionSourceChange}
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          {INGESTION_SOURCE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={`${filters.sort_by || "created_at"}:${filters.sort_order || "desc"}`}
          onChange={handleSortChange}
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:ring-2 focus:ring-offset-2 focus:outline-none"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

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
