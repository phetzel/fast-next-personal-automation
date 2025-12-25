"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useResumes } from "@/hooks";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Badge,
} from "@/components/ui";
import type { ResumeSummary } from "@/types";
import {
  Loader2,
  Upload,
  Trash2,
  Star,
  StarOff,
  FileText,
  File,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

// Accepted file types
const ACCEPTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

const ACCEPTED_EXTENSIONS = ".pdf,.docx,.txt";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (mimeType.includes("wordprocessingml")) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
}

/**
 * Resume upload dropzone component.
 */
function ResumeUploadZone({
  onUpload,
  isUploading,
}: {
  onUpload: (file: File, name: string) => Promise<void>;
  isUploading: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && ACCEPTED_TYPES.includes(file.type)) {
      setSelectedFile(file);
      // Set default name from filename without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // Set default name from filename without extension
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  }, []);

  const handleUpload = async () => {
    if (!selectedFile || !name.trim()) return;
    await onUpload(selectedFile, name.trim());
    setSelectedFile(null);
    setName("");
  };

  const handleCancel = () => {
    setSelectedFile(null);
    setName("");
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors
          ${isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground">PDF, DOCX, or TXT (max 10MB)</p>
      </div>

      {/* Selected file preview */}
      {selectedFile && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              {getFileIcon(selectedFile.type)}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  Resume Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Software Engineer Resume"
                  maxLength={100}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={isUploading || !name.trim()}
                  className="flex-1"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={isUploading}>
                  Cancel
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/**
 * Resume list item component.
 */
function ResumeListItem({
  resume,
  onDelete,
  onSetPrimary,
  isLoading,
}: {
  resume: ResumeSummary;
  onDelete: () => void;
  onSetPrimary: () => void;
  isLoading?: boolean;
}) {
  return (
    <Card className={resume.is_primary ? "border-primary/50 ring-1 ring-primary/20" : ""}>
      <CardContent className="flex items-center gap-4 py-4">
        {getFileIcon(resume.original_filename.endsWith(".pdf") ? "application/pdf" : "other")}
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{resume.name}</p>
            {resume.is_primary && (
              <Badge variant="default" className="shrink-0">
                <Star className="mr-1 h-3 w-3" />
                Primary
              </Badge>
            )}
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {resume.original_filename}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {resume.has_text ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Text extracted
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No text extracted
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          {!resume.is_primary && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSetPrimary}
              disabled={isLoading}
              title="Set as primary"
            >
              <StarOff className="h-4 w-4" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="hover:text-destructive"
            title="Delete resume"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * Resume Manager component for uploading and managing resumes.
 */
export function ResumeManager() {
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

  // Fetch resumes on mount
  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  const handleUpload = async (file: File, name: string) => {
    setIsUploading(true);
    await uploadResume(file, name, resumes.length === 0); // Set as primary if first resume
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
          <ResumeUploadZone onUpload={handleUpload} isUploading={isUploading} />
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && resumes.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Resume List */}
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

      {/* Empty state */}
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



