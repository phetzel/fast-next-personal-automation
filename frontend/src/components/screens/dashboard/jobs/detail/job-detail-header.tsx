import Link from "next/link";
import { ScoreBadge, StatusBadge } from "@/components/shared/jobs";
import { Button } from "@/components/ui";
import type { Job } from "@/types";
import { format } from "date-fns";
import {
  Building2,
  Calendar,
  DollarSign,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Trash2,
} from "lucide-react";

interface JobDetailHeaderProps {
  job: Job;
  isDeleting: boolean;
  onDelete: () => void;
}

export function JobDetailHeader({ job, isDeleting, onDelete }: JobDetailHeaderProps) {
  const postedDate = job.date_posted ? format(new Date(job.date_posted), "MMM d, yyyy") : null;

  return (
    <>
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Link href="/jobs/list" className="hover:text-foreground transition-colors">
          Jobs
        </Link>
        <span>/</span>
        <span className="text-foreground max-w-[300px] truncate">{job.title}</span>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">{job.title}</h1>
            <StatusBadge status={job.status} />
            <ScoreBadge score={job.relevance_score} />
          </div>
          <div className="text-muted-foreground flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              <span className="font-medium">{job.company}</span>
            </div>
            {job.location && (
              <div className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {job.location}
              </div>
            )}
            {postedDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />
                Posted {postedDate}
              </div>
            )}
            {job.source && (
              <div className="flex items-center gap-1.5">
                <Globe className="h-4 w-4" />
                <span className="capitalize">{job.source}</span>
              </div>
            )}
          </div>
          {job.salary_range && (
            <div className="flex items-center gap-1.5 font-semibold text-green-600">
              <DollarSign className="h-4 w-4" />
              {job.salary_range}
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <a href={job.job_url} target="_blank" rel="noopener noreferrer">
              View Posting
              <ExternalLink className="ml-2 h-4 w-4" />
            </a>
          </Button>
          <Button variant="destructive" size="icon" onClick={onDelete} disabled={isDeleting}>
            {isDeleting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </>
  );
}
