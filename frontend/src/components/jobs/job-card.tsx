"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { Job } from "@/types";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./status-badge";
import { ScoreBadge } from "./score-badge";
import { IngestionSourceBadge } from "./ingestion-source";
import { Building2, MapPin, Calendar, ExternalLink } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface JobCardProps {
  job: Job;
  onClick?: () => void;
  className?: string;
}

export function JobCard({ job, onClick, className }: JobCardProps) {
  const postedDate = job.date_posted
    ? formatDistanceToNow(new Date(job.date_posted), { addSuffix: true })
    : null;
  const createdDate = formatDistanceToNow(new Date(job.created_at), {
    addSuffix: true,
  });

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md",
        "hover:ring-primary/20 hover:ring-2",
        job.relevance_score && job.relevance_score >= 8 && "border-green-500/30",
        className
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <CardTitle className="line-clamp-1 text-base font-semibold">{job.title}</CardTitle>
            <div className="text-muted-foreground mt-1 flex items-center gap-1.5 text-sm">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{job.company}</span>
            </div>
          </div>
          <ScoreBadge score={job.relevance_score} />
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Location and date */}
        <div className="text-muted-foreground flex flex-wrap gap-3 text-xs">
          {job.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate">{job.location}</span>
            </div>
          )}
          {(postedDate || createdDate) && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{postedDate || `Added ${createdDate}`}</span>
            </div>
          )}
        </div>

        {/* Salary if available */}
        {job.salary_range && (
          <p className="text-sm font-medium text-green-600">{job.salary_range}</p>
        )}

        {/* Status and source */}
        <div className="flex items-center justify-between">
          <StatusBadge status={job.status} />
          <div className="flex items-center gap-2">
            {/* Ingestion source indicator */}
            <IngestionSourceBadge source={job.ingestion_source} />
            {job.source && (
              <span className="text-muted-foreground text-xs capitalize">{job.source}</span>
            )}
            <a
              href={job.job_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
