"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useResumes } from "@/hooks";
import { Button } from "@/components/ui";
import type { ResumeSummary } from "@/types";
import { FileText, ChevronDown, Check, ExternalLink, Loader2 } from "lucide-react";
import { ROUTES } from "@/lib/constants";

interface ResumeSelectorProps {
  value: string | null;
  onChange: (resumeId: string | null) => void;
  disabled?: boolean;
  placeholder?: string;
}

/**
 * Resume selector dropdown for profile forms.
 */
export function ResumeSelector({
  value,
  onChange,
  disabled = false,
  placeholder = "Select a resume...",
}: ResumeSelectorProps) {
  const { resumes, isLoading, fetchResumes } = useResumes();
  const [isOpen, setIsOpen] = useState(false);

  // Fetch resumes on mount
  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  // Find selected resume
  const selectedResume = resumes.find((r) => r.id === value);

  const handleSelect = (resume: ResumeSummary | null) => {
    onChange(resume?.id ?? null);
    setIsOpen(false);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-resume-selector]")) {
        setIsOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" data-resume-selector>
      {/* Trigger button */}
      <Button
        type="button"
        variant="outline"
        className="w-full justify-between"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isLoading}
      >
        <span className="flex items-center gap-2 truncate">
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : selectedResume ? (
            <>
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="truncate">{selectedResume.name}</span>
              {!selectedResume.has_text && (
                <span className="text-xs text-amber-600">(no text)</span>
              )}
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {/* No resume option */}
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => handleSelect(null)}
          >
            <span className="w-4" />
            <span className="text-muted-foreground">No resume</span>
            {!value && <Check className="ml-auto h-4 w-4" />}
          </button>

          {/* Separator */}
          {resumes.length > 0 && <div className="my-1 border-t" />}

          {/* Resume options */}
          {resumes.map((resume) => (
            <button
              key={resume.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
              onClick={() => handleSelect(resume)}
            >
              <FileText className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1 text-left">
                <div className="flex items-center gap-1.5">
                  <span className="truncate">{resume.name}</span>
                  {resume.is_primary && (
                    <span className="shrink-0 rounded bg-primary/10 px-1 text-xs text-primary">
                      Primary
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="truncate">{resume.original_filename}</span>
                  {!resume.has_text && (
                    <span className="text-amber-600">(no text)</span>
                  )}
                </div>
              </div>
              {value === resume.id && <Check className="ml-auto h-4 w-4 shrink-0" />}
            </button>
          ))}

          {/* Empty state */}
          {resumes.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No resumes uploaded yet
            </div>
          )}

          {/* Separator and upload link */}
          <div className="my-1 border-t" />
          <Link
            href={ROUTES.JOBS_PROFILES}
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-primary hover:bg-accent"
            onClick={() => setIsOpen(false)}
          >
            <ExternalLink className="h-4 w-4" />
            Manage resumes
          </Link>
        </div>
      )}
    </div>
  );
}

