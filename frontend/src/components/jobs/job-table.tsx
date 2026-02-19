"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type RowSelectionState,
} from "@tanstack/react-table";
import type { Job } from "@/types";
import { StatusBadge } from "./status-badge";
import { ScoreBadge } from "./score-badge";
import { IngestionSourceBadge } from "./ingestion-source";
import { Button } from "@/components/ui";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Building2,
  MapPin,
  Trash2,
  FileText,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface JobTableProps {
  jobs: Job[];
  total: number;
  page: number;
  pageSize: number;
  isLoading?: boolean;
  preppingJobId?: string | null;
  onJobClick?: (job: Job) => void;
  onDelete?: (jobId: string) => void;
  onPrep?: (job: Job) => void;
  onPageChange?: (page: number) => void;
  onSort?: (sortBy: string, sortOrder: "asc" | "desc") => void;
  className?: string;
}

export function JobTable({
  jobs,
  total,
  page,
  pageSize,
  isLoading,
  preppingJobId,
  onJobClick,
  onDelete,
  onPrep,
  onPageChange,
  onSort,
  className,
}: JobTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const totalPages = Math.ceil(total / pageSize);
  const hasMore = page < totalPages;
  const hasPrevious = page > 1;

  // Handle sorting changes - sync with server-side sorting
  const handleSortingChange = (updater: SortingState | ((old: SortingState) => SortingState)) => {
    const newSorting = typeof updater === "function" ? updater(sorting) : updater;
    setSorting(newSorting);

    if (newSorting.length > 0 && onSort) {
      const { id, desc } = newSorting[0];
      // Map column IDs to API field names
      const fieldMap: Record<string, string> = {
        relevance_score: "relevance_score",
        company: "company",
        date_posted: "date_posted",
        created_at: "created_at",
      };
      const field = fieldMap[id] || id;
      onSort(field, desc ? "desc" : "asc");
    }
  };

  const columns = useMemo<ColumnDef<Job>[]>(
    () => [
      {
        accessorKey: "title",
        header: "Job",
        cell: ({ row }) => {
          const job = row.original;
          return (
            <div className="max-w-[300px] min-w-[200px]">
              <button
                onClick={() => onJobClick?.(job)}
                className="text-left hover:underline focus:outline-none"
              >
                <span className="line-clamp-1 font-medium">{job.title}</span>
              </button>
              <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
                <Building2 className="h-3 w-3 shrink-0" />
                <span className="truncate">{job.company}</span>
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "company",
        header: ({ column }) => <SortableHeader column={column} label="Company" />,
        cell: ({ row }) => <span className="text-sm">{row.original.company}</span>,
        // Hidden by default, data shown in title column
        meta: { hidden: true },
      },
      {
        accessorKey: "location",
        header: "Location",
        cell: ({ row }) => {
          const job = row.original;
          return (
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5 text-sm">
                <MapPin className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                <span className="max-w-[150px] truncate">{job.location || "—"}</span>
              </div>
              <div className="flex items-center gap-1">
                {job.is_remote && (
                  <span className="inline-flex items-center rounded-full bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                    Remote
                  </span>
                )}
                {job.job_type && (
                  <span className="text-muted-foreground inline-flex items-center rounded-full bg-gray-500/10 px-1.5 py-0.5 text-[10px] font-medium capitalize">
                    {job.job_type}
                  </span>
                )}
              </div>
            </div>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "relevance_score",
        header: ({ column }) => <SortableHeader column={column} label="Score" />,
        cell: ({ row }) => <ScoreBadge score={row.original.relevance_score} />,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => <StatusBadge status={row.original.status} />,
        enableSorting: false,
      },
      {
        accessorKey: "salary_range",
        header: "Salary",
        cell: ({ row }) => {
          const salary = row.original.salary_range;
          if (!salary) return <span className="text-muted-foreground">—</span>;
          return (
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{salary}</span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "date_posted",
        header: ({ column }) => <SortableHeader column={column} label="Posted" />,
        cell: ({ row }) => {
          const datePosted = row.original.date_posted;
          if (!datePosted) {
            return <span className="text-muted-foreground text-xs">—</span>;
          }
          return (
            <span className="text-muted-foreground text-xs">
              {formatDistanceToNow(new Date(datePosted), { addSuffix: true })}
            </span>
          );
        },
      },
      {
        accessorKey: "source",
        header: "Source",
        cell: ({ row }) => {
          const job = row.original;

          return (
            <div className="flex flex-col gap-0.5">
              {/* Platform source with link */}
              {job.source ? (
                <a
                  href={job.job_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs capitalize transition-colors"
                  onClick={(e) => e.stopPropagation()}
                  title="View original job posting"
                >
                  {job.source}
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : (
                <span className="text-muted-foreground text-xs">—</span>
              )}
              {/* Ingestion source indicator */}
              <IngestionSourceBadge source={job.ingestion_source} showLabel />
            </div>
          );
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const job = row.original;
          const isPrepping = preppingJobId === job.id;
          const showPrepButton = job.status === "new" && onPrep;

          return (
            <div className="flex items-center gap-1">
              {isPrepping && (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-blue-500/10 px-2 text-xs font-medium text-blue-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Prepping...
                </span>
              )}
              {showPrepButton && !isPrepping && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPrep(job);
                  }}
                  className="bg-primary/10 text-primary hover:bg-primary/20 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors"
                  title="Prepare cover letter & notes"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Prep
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(job.id);
                }}
                className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors"
                title="Delete job"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        },
        enableSorting: false,
      },
    ],
    [onJobClick, onDelete, onPrep, preppingJobId]
  );

  // Filter out hidden columns
  const visibleColumns = useMemo(
    () => columns.filter((col) => !(col.meta as { hidden?: boolean })?.hidden),
    [columns]
  );

  const table = useReactTable({
    data: jobs,
    columns: visibleColumns,
    state: {
      sorting,
      rowSelection,
    },
    onSortingChange: handleSortingChange,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualSorting: true, // Server-side sorting
    manualPagination: true, // Server-side pagination
  });

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <div className={cn("py-12 text-center", className)}>
        <p className="text-muted-foreground">No jobs found</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Try adjusting your filters or run a job search
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Table */}
      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                className={cn(
                  "cursor-pointer",
                  row.original.relevance_score &&
                    row.original.relevance_score >= 8 &&
                    "bg-green-500/5"
                )}
                onClick={() => onJobClick?.(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} jobs
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page - 1)}
              disabled={!hasPrevious}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Previous
            </Button>
            <span className="text-muted-foreground text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange?.(page + 1)}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sortable column header component
function SortableHeader({
  column,
  label,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
  label: string;
}) {
  const sorted = column.getIsSorted();

  return (
    <button
      onClick={() => column.toggleSorting(sorted === "asc")}
      className="hover:text-foreground inline-flex items-center gap-1"
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="h-3.5 w-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="h-3.5 w-3.5" />
      ) : (
        <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />
      )}
    </button>
  );
}
