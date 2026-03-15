"use client";

import type { ChangeEvent } from "react";
import { format } from "date-fns";
import { Button, Card, CardContent, CardHeader, CardTitle, Textarea } from "@/components/ui";
import type { Job } from "@/types";
import {
  AlertCircle,
  CheckCircle,
  Download,
  Eye,
  FileText,
  Loader2,
  MessageSquare,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";

interface PrepTabProps {
  job: Job;
  coverLetter: string;
  setCoverLetter: (value: string) => void;
  coverLetterDirty: boolean;
  setCoverLetterDirty: (value: boolean) => void;
  isUpdating: boolean;
  isGeneratingPdf: boolean;
  isDownloading: boolean;
  hasPdf: boolean;
  pdfError: string | null;
  downloadError: string | null;
  onSave: () => void;
  onPreview: () => void;
  onDownload: () => void;
  onRegenerate: () => void;
  onAnalyze: () => void;
  onPrep: () => void;
  hasPreppedMaterials: boolean;
  isPrepping: boolean;
}

export function PrepTab({
  job,
  coverLetter,
  setCoverLetter,
  coverLetterDirty,
  setCoverLetterDirty,
  isUpdating,
  isGeneratingPdf,
  isDownloading,
  hasPdf,
  pdfError,
  downloadError,
  onSave,
  onPreview,
  onDownload,
  onRegenerate,
  onAnalyze,
  onPrep,
  hasPreppedMaterials,
  isPrepping,
}: PrepTabProps) {
  if (!hasPreppedMaterials) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="bg-muted mb-4 rounded-full p-4">
          <FileText className="text-muted-foreground h-8 w-8" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">
          {job.status === "new" ? "Waiting for Analysis" : "No Materials Generated"}
        </h3>
        <p className="text-muted-foreground mb-6 max-w-md">
          {job.status === "new"
            ? "Run Manual Analyze first to mark whether a cover letter is needed and add any custom questions."
            : "Run the prep pipeline to generate a tailored cover letter and interview talking points based on your resume and the job description."}
        </p>
        <Button
          onClick={job.status === "new" ? onAnalyze : onPrep}
          disabled={isPrepping || (job.status !== "new" && job.status !== "analyzed")}
        >
          {isPrepping ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {job.status === "new" ? "Run Manual Analyze" : "Start Prep"}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileText className="h-5 w-5" />
                Cover Letter
              </CardTitle>
              <div className="flex items-center gap-2">
                {coverLetterDirty && (
                  <Button size="sm" variant="outline" onClick={onSave} disabled={isUpdating}>
                    {isUpdating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Save Changes
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Textarea
              value={coverLetter}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) => {
                setCoverLetter(event.target.value);
                setCoverLetterDirty(event.target.value !== job.cover_letter);
              }}
              placeholder="Your cover letter..."
              rows={16}
              className="resize-none font-mono text-sm"
            />
          </CardContent>
        </Card>

        {job.prep_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MessageSquare className="h-5 w-5" />
                Interview Talking Points
              </CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="font-sans text-sm leading-relaxed whitespace-pre-wrap">
                {job.prep_notes}
              </pre>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Cover Letter PDF</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pdfError && (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{pdfError}</span>
                </div>
              </div>
            )}

            {downloadError && (
              <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  <span>{downloadError}</span>
                </div>
              </div>
            )}

            {hasPdf ? (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                  <CheckCircle className="h-4 w-4" />
                  <span>
                    PDF generated{" "}
                    {job.cover_letter_generated_at
                      ? format(new Date(job.cover_letter_generated_at), "MMM d, h:mm a")
                      : ""}
                  </span>
                </div>

                <div className="flex flex-col gap-2">
                  <Button variant="outline" onClick={onPreview} className="justify-start">
                    <Eye className="mr-2 h-4 w-4" />
                    Preview PDF
                  </Button>
                  <Button
                    variant="outline"
                    onClick={onDownload}
                    disabled={isDownloading}
                    className="justify-start"
                  >
                    {isDownloading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download PDF
                  </Button>
                </div>

                {coverLetterDirty && (
                  <>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      You have unsaved changes. Save first, then regenerate the PDF.
                    </p>
                    <Button
                      variant="outline"
                      onClick={onRegenerate}
                      disabled={isGeneratingPdf}
                      className="w-full border-amber-500/30 hover:bg-amber-500/10"
                    >
                      {isGeneratingPdf ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                      Regenerate PDF
                    </Button>
                  </>
                )}
              </>
            ) : (
              <div className="py-4 text-center">
                <p className="text-muted-foreground mb-3 text-sm">
                  No PDF generated yet. Mark as &quot;Reviewed&quot; to generate.
                </p>
                <Button variant="outline" onClick={onRegenerate} disabled={isGeneratingPdf}>
                  {isGeneratingPdf ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generate PDF
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Need Changes?</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-3 text-sm">
              Want to start fresh? Re-run the AI prep to generate new materials.
            </p>
            <Button variant="outline" onClick={onPrep} disabled={isPrepping} className="w-full">
              {isPrepping ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerate All
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
