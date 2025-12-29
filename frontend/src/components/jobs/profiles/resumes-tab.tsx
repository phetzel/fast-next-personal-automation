"use client";

import { useState, useEffect } from "react";
import { useResumes } from "@/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { FileUploadZone } from "@/components/shared";
import { ResumeListItem } from "./resume-list-item";
import { RESUME_ACCEPTED_TYPES, RESUME_ACCEPTED_EXTENSIONS } from "@/lib/file-utils";
import { Loader2, FileText } from "lucide-react";

export function ResumesTab() {
  const {
    resumes,
    isLoading,
    error,
    fetchResumes,
    uploadResume,
    deleteResume,
    setPrimary,
  } = useResumes();

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleUpload = async (file: File, name: string) => {
    setIsUploading(true);
    await uploadResume(file, name, resumes.length === 0);
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this resume?")) return;
    await deleteResume(id);
  };

  const handleSetPrimary = async (id: string) => {
    await setPrimary(id);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Resume</CardTitle>
          <CardDescription>
            Upload your resume in PDF, DOCX, or TXT format. Text will be automatically
            extracted for AI job matching.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <FileUploadZone
            onUpload={handleUpload}
            isUploading={isUploading}
            acceptedTypes={RESUME_ACCEPTED_TYPES}
            acceptedExtensions={RESUME_ACCEPTED_EXTENSIONS}
            maxSizeLabel="max 10MB"
            nameLabel="Resume Name"
            namePlaceholder="e.g., Software Engineer Resume"
            acceptedTypesLabel="PDF, DOCX, or TXT"
          />
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && resumes.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {resumes.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg font-semibold">Your Resumes</h2>
          <div className="space-y-2">
            {resumes.map((resume) => (
              <ResumeListItem
                key={resume.id}
                resume={resume}
                onDelete={() => handleDelete(resume.id)}
                onSetPrimary={() => handleSetPrimary(resume.id)}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && resumes.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No Resumes Yet</h3>
            <p className="text-sm text-muted-foreground">
              Upload your first resume to get started with job matching.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

