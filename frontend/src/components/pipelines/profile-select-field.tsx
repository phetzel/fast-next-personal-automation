"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useJobProfiles } from "@/hooks/use-job-profiles";
import { Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import { AlertTriangle, Plus, User, ChevronDown } from "lucide-react";

interface ProfileSelectFieldProps {
  id: string;
  value: unknown;
  onChange: (value: string | undefined) => void;
  required?: boolean;
  description?: string;
}

/**
 * A specialized select field for choosing a job profile.
 * Fetches profiles on mount and renders them with badges for default and resume status.
 */
export function ProfileSelectField({
  id,
  value,
  onChange,
  required,
  description,
}: ProfileSelectFieldProps) {
  const { profiles, isLoading, error, fetchProfiles, hasProfiles } = useJobProfiles();

  // Fetch profiles on mount
  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  // No profiles - show prominent CTA
  if (!isLoading && !hasProfiles) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Profile
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/10 p-2">
              <User className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                No Job Profiles Found
              </p>
              <p className="text-muted-foreground mt-1 text-sm">
                Create a job profile with your resume to start searching for jobs.
              </p>
              <Link
                href="/jobs/profiles"
                className={cn(
                  "mt-3 inline-flex items-center gap-1.5 rounded-md",
                  "bg-amber-500 px-3 py-1.5 text-sm font-medium text-white",
                  "transition-colors hover:bg-amber-600"
                )}
              >
                <Plus className="h-4 w-4" />
                Create Profile
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Profile
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="bg-muted/50 flex h-10 w-full animate-pulse items-center rounded-md border px-3">
          <span className="text-muted-foreground text-sm">Loading profiles...</span>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-2">
        <Label htmlFor={id} className="flex items-center gap-1">
          Profile
          {required && <span className="text-destructive">*</span>}
        </Label>
        <div className="border-destructive/50 bg-destructive/5 flex h-10 w-full items-center gap-2 rounded-md border px-3">
          <AlertTriangle className="text-destructive h-4 w-4" />
          <span className="text-destructive text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Find the default profile
  const defaultProfile = profiles.find((p) => p.is_default);

  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="flex items-center gap-1">
        Profile
        {required && <span className="text-destructive">*</span>}
      </Label>
      <div className="relative">
        <select
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value || undefined)}
          required={required}
          className={cn(
            "border-input bg-background ring-offset-background",
            "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border py-2 pr-10 pl-3",
            "text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          <option value="">
            {defaultProfile ? `Use default (${defaultProfile.name})` : "Select a profile..."}
          </option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
              {profile.is_default ? " (default)" : ""}
              {!profile.has_resume ? " ⚠️" : ""}
            </option>
          ))}
        </select>
        <ChevronDown className="text-muted-foreground pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2" />
      </div>

      {/* Show selected profile info */}
      {typeof value === "string" && value && (
        <SelectedProfileInfo profile={profiles.find((p) => p.id === value)} />
      )}

      {/* Description */}
      {description && <p className="text-muted-foreground text-xs">{description}</p>}

      {/* Link to manage profiles */}
      <Link
        href="/jobs/profiles"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <User className="h-3 w-3" />
        Manage profiles
      </Link>
    </div>
  );
}

/**
 * Shows details about the selected profile.
 */
function SelectedProfileInfo({
  profile,
}: {
  profile?: { name: string; has_resume: boolean; resume_name: string | null };
}) {
  if (!profile) return null;

  return (
    <div
      className={cn(
        "rounded-md border px-3 py-2 text-sm",
        profile.has_resume
          ? "border-green-500/20 bg-green-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      )}
    >
      {profile.has_resume ? (
        <p className="text-green-600 dark:text-green-400">✓ Resume: {profile.resume_name}</p>
      ) : (
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-4 w-4" />
          <span>No resume linked to this profile</span>
        </div>
      )}
    </div>
  );
}
