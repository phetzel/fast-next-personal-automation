"use client";

import { Button, Input } from "@/components/ui";
import type { JobFilters, JobStatus } from "@/types";
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

export function JobFilters({
  filters,
  onFiltersChange,
  onReset,
  className,
}: JobFiltersProps) {
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
      JobFilters["sort_order"]
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

  const hasActiveFilters =
    filters.status ||
    filters.search ||
    filters.min_score !== undefined ||
    filters.max_score !== undefined ||
    filters.posted_within_hours !== undefined;

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <form onSubmit={handleSearch} className="relative flex-1 min-w-[200px]">
          <Search className="text-muted-foreground absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search jobs..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="pl-9 pr-9"
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                onFiltersChange({ search: undefined, page: 1 });
              }}
              className="text-muted-foreground hover:text-foreground absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </form>

        {/* Status filter */}
        <select
          value={filters.status || "all"}
          onChange={handleStatusChange}
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
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
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          {RECENCY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Sort */}
        <select
          value={`${filters.sort_by || "created_at"}:${filters.sort_order || "desc"}`}
          onChange={handleSortChange}
          className="border-input bg-background ring-offset-background focus:ring-ring h-10 rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Reset */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-muted-foreground"
          >
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

