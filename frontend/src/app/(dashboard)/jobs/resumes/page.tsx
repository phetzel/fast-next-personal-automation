"use client";

import { ResumeManager } from "@/components/jobs";

/**
 * Resume management page.
 * Allows users to upload, view, and manage their resumes.
 */
export default function ResumesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Resumes</h1>
        <p className="text-muted-foreground">
          Manage your resume files for job matching
        </p>
      </div>

      <ResumeManager />
    </div>
  );
}

