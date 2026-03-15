"use client";

import { use } from "react";
import Link from "next/link";
import {
  JobDetailHeader,
  JobDetailTabs,
  JobStatusBar,
  OverviewTab,
  PrepTab,
  useJobDetailScreen,
} from "@/components/screens/dashboard/jobs/detail";
import { Button } from "@/components/ui";
import { ManualAnalyzeModal, PrepJobModal } from "@/components/shared/jobs";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function JobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: jobId } = use(params);
  const screen = useJobDetailScreen(jobId);

  if (screen.isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!screen.job) {
    return (
      <div className="flex h-96 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Job not found</p>
        <Button asChild variant="outline">
          <Link href="/jobs/list">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <JobDetailHeader
        job={screen.job}
        isDeleting={screen.isDeleting}
        onDelete={screen.handleDelete}
      />

      <JobStatusBar
        job={screen.job}
        isUpdating={screen.isUpdating}
        isGeneratingPdf={screen.isGeneratingPdf}
        isPrepping={screen.isPrepping}
        onStatusChange={screen.handleStatusChange}
      />

      <JobDetailTabs
        activeTab={screen.activeTab}
        hasPreppedMaterials={screen.hasPreppedMaterials}
        onTabChange={screen.setActiveTab}
        overviewContent={
          <OverviewTab
            job={screen.job}
            hasApplicationAnalysis={screen.hasApplicationAnalysis}
            notes={screen.notes}
            setNotes={screen.setNotes}
            notesDirty={screen.notesDirty}
            setNotesDirty={screen.setNotesDirty}
            isUpdating={screen.isUpdating}
            onSaveNotes={screen.handleSaveNotes}
            onAnalyze={screen.openManualAnalyze}
            onPrep={() => screen.setIsPrepModalOpen(true)}
            hasPreppedMaterials={screen.hasPreppedMaterials}
            isPrepping={screen.isPrepping}
          />
        }
        prepContent={
          <PrepTab
            job={screen.job}
            coverLetter={screen.coverLetter}
            setCoverLetter={screen.setCoverLetter}
            coverLetterDirty={screen.coverLetterDirty}
            setCoverLetterDirty={screen.setCoverLetterDirty}
            isUpdating={screen.isUpdating}
            isGeneratingPdf={screen.isGeneratingPdf}
            isDownloading={screen.isDownloading}
            hasPdf={screen.hasPdf}
            pdfError={screen.pdfError}
            downloadError={screen.downloadError}
            onSave={screen.handleSaveCoverLetter}
            onPreview={screen.handlePreviewPdf}
            onDownload={screen.handleDownloadPdf}
            onRegenerate={screen.handleRegeneratePdf}
            onAnalyze={screen.openManualAnalyze}
            onPrep={() => screen.setIsPrepModalOpen(true)}
            hasPreppedMaterials={screen.hasPreppedMaterials}
            isPrepping={screen.isPrepping}
          />
        }
      />

      <ManualAnalyzeModal
        job={screen.analyzeJob}
        isOpen={screen.isManualAnalyzeModalOpen}
        onClose={screen.closeManualAnalyze}
        onComplete={screen.handleManualAnalyzeComplete}
      />

      <PrepJobModal
        job={screen.job}
        isOpen={screen.isPrepModalOpen}
        onClose={() => screen.setIsPrepModalOpen(false)}
        onComplete={screen.handlePrepComplete}
      />
    </div>
  );
}
