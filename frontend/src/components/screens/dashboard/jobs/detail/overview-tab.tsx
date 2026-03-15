"use client";

import type { ChangeEvent } from "react";
import { format } from "date-fns";
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@/components/ui";
import { getScreeningQuestionText, type Job } from "@/types";
import {
  ClipboardCheck,
  ExternalLink,
  Loader2,
  MessageSquare,
  Save,
  Sparkles,
  Clock,
} from "lucide-react";
import { TimelineItem } from "./timeline-item";

interface OverviewTabProps {
  job: Job;
  hasApplicationAnalysis: boolean;
  notes: string;
  setNotes: (value: string) => void;
  notesDirty: boolean;
  setNotesDirty: (value: boolean) => void;
  isUpdating: boolean;
  onSaveNotes: () => void;
  onAnalyze: () => void;
  onPrep: () => void;
  hasPreppedMaterials: boolean;
  isPrepping: boolean;
}

export function OverviewTab({
  job,
  hasApplicationAnalysis,
  notes,
  setNotes,
  notesDirty,
  setNotesDirty,
  isUpdating,
  onSaveNotes,
  onAnalyze,
  onPrep,
  hasPreppedMaterials,
  isPrepping,
}: OverviewTabProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        {job.reasoning && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Sparkles className="h-5 w-5 text-amber-500" />
                AI Match Analysis
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">{job.reasoning}</p>
            </CardContent>
          </Card>
        )}

        {job.description && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Full Description</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm whitespace-pre-wrap">{job.description}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {hasApplicationAnalysis && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <CardTitle className="text-lg">Application Requirements</CardTitle>
                {job.status === "analyzed" && (
                  <Button size="sm" variant="outline" onClick={onAnalyze}>
                    <ClipboardCheck className="mr-2 h-4 w-4" />
                    Edit Analysis
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <span className="text-muted-foreground">Application type:</span>{" "}
                  <span className="capitalize">{job.application_type || "Unknown"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Cover letter:</span>{" "}
                  {job.requires_cover_letter === null
                    ? "Unknown"
                    : job.requires_cover_letter
                      ? "Required"
                      : "Not required"}
                </div>
                <div>
                  <span className="text-muted-foreground">Resume:</span>{" "}
                  {job.requires_resume === null
                    ? "Unknown"
                    : job.requires_resume
                      ? "Required"
                      : "Not required"}
                </div>
                <div>
                  <span className="text-muted-foreground">Screening questions:</span>{" "}
                  {job.screening_questions?.length ?? 0}
                </div>
              </div>
              {job.application_url && (
                <Button asChild variant="outline" size="sm">
                  <a href={job.application_url} target="_blank" rel="noopener noreferrer">
                    Open Application
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              )}
              {!!job.screening_questions?.length && (
                <div className="space-y-2">
                  <p className="font-medium">Questions to prep</p>
                  <ul className="space-y-1">
                    {job.screening_questions.map((question, index) => {
                      const questionText = getScreeningQuestionText(question);
                      if (!questionText) {
                        return null;
                      }

                      return (
                        <li
                          key={`${job.id}-screening-${index}`}
                          className="bg-muted/40 rounded-md px-3 py-2"
                        >
                          {questionText}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Personal Notes
              </CardTitle>
              {notesDirty && (
                <Button size="sm" variant="outline" onClick={onSaveNotes} disabled={isUpdating}>
                  {isUpdating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={notes}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setNotes(event.target.value);
                setNotesDirty(event.target.value !== (job.notes || ""));
              }}
              placeholder="Add personal notes, recruiter contacts, follow-up reminders, questions to ask..."
              rows={6}
              className="resize-none"
            />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        {!hasPreppedMaterials && job.status === "analyzed" && (
          <Card className="border-primary/30 bg-primary/5 border-2 border-dashed">
            <CardContent className="py-6">
              <div className="flex flex-col items-center text-center">
                <div className="bg-primary/10 mb-3 rounded-full p-3">
                  <Sparkles className="text-primary h-6 w-6" />
                </div>
                <h3 className="mb-1 font-semibold">Ready to Prep?</h3>
                <p className="text-muted-foreground mb-4 text-sm">
                  AI will generate a tailored cover letter, prep notes, and screening answers.
                </p>
                <Button onClick={onPrep} disabled={isPrepping}>
                  {isPrepping ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="mr-2 h-4 w-4" />
                  )}
                  Start Prep
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!hasPreppedMaterials && job.status === "new" && (
          <Card className="border-2 border-dashed border-blue-500/30 bg-blue-500/5">
            <CardContent className="py-6">
              <div className="space-y-3 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  Run Manual Analyze to mark whether a cover letter is needed and add any custom
                  questions you want prepped.
                </p>
                <Button variant="outline" size="sm" onClick={onAnalyze}>
                  <ClipboardCheck className="mr-2 h-4 w-4" />
                  Manual Analyze
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.job_type && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Type</span>
                <span className="capitalize">{job.job_type}</span>
              </div>
            )}
            {job.is_remote !== null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Remote</span>
                <span>{job.is_remote ? "Yes" : "No"}</span>
              </div>
            )}
            {job.search_terms && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Search Terms</span>
                <span className="max-w-[150px] truncate">{job.search_terms}</span>
              </div>
            )}
            {job.analyzed_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Analyzed</span>
                <span>{format(new Date(job.analyzed_at), "MMM d, yyyy")}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Added</span>
              <span>{format(new Date(job.created_at), "MMM d, yyyy")}</span>
            </div>
            {job.prepped_at && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Prepped</span>
                <span>{format(new Date(job.prepped_at), "MMM d, yyyy")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <TimelineItem label="Job Added" date={job.created_at} isCompleted />
              {job.analyzed_at && (
                <TimelineItem label="Application Analyzed" date={job.analyzed_at} isCompleted />
              )}
              {job.prepped_at && (
                <TimelineItem label="Materials Generated" date={job.prepped_at} isCompleted />
              )}
              {job.cover_letter_generated_at && (
                <TimelineItem
                  label="PDF Created"
                  date={job.cover_letter_generated_at}
                  isCompleted
                />
              )}
              {job.status === "applied" && (
                <TimelineItem
                  label="Application Sent"
                  date={job.applied_at || job.updated_at || job.created_at}
                  isCompleted
                />
              )}
              {job.status === "interviewing" && (
                <TimelineItem
                  label="Interview Stage"
                  date={job.updated_at || job.applied_at || job.created_at}
                  isCompleted
                />
              )}
              {job.status === "rejected" && (
                <TimelineItem
                  label="Not Selected"
                  date={job.updated_at || job.created_at}
                  isCompleted
                  isRejected
                />
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
