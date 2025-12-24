"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, Button, Label } from "@/components/ui";
import { CopyButton } from "@/components/chat/copy-button";
import { useJobProfiles } from "@/hooks/use-job-profiles";
import type { ExecutionState, ProfileRequiredError } from "@/types";
import { CheckCircle, XCircle, Loader2, Clock, User, Plus, AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ExecutionResultProps {
  state: ExecutionState;
  onReset?: () => void;
  /** Called when user selects a profile after a profile_required error */
  onRetryWithProfile?: (profileId: string) => void;
}

/**
 * Try to parse a profile_required error from the error string.
 */
function parseProfileRequiredError(error: string | null): ProfileRequiredError | null {
  if (!error) return null;
  try {
    const parsed = JSON.parse(error);
    if (parsed.error_type === "profile_required") {
      return parsed as ProfileRequiredError;
    }
  } catch {
    // Not JSON, return null
  }
  return null;
}

/**
 * Displays the result of a pipeline execution.
 */
export function ExecutionResult({ state, onReset, onRetryWithProfile }: ExecutionResultProps) {
  const { status, result, startedAt, completedAt } = state;
  const [selectedProfileId, setSelectedProfileId] = useState<string>("");
  const { profiles, fetchProfiles, isLoading: profilesLoading } = useJobProfiles();

  // Check if this is a profile_required error
  const profileError = parseProfileRequiredError(result?.error ?? null);

  // Fetch fresh profiles when we have a profile_required error
  useEffect(() => {
    if (profileError && profiles.length === 0) {
      fetchProfiles();
    }
  }, [profileError, profiles.length, fetchProfiles]);

  // Use profiles from error response or from hook
  const availableProfiles = profileError?.available_profiles ?? profiles;

  if (status === "idle") {
    return null;
  }

  const duration =
    startedAt && completedAt
      ? Math.round((completedAt.getTime() - startedAt.getTime()) / 1000 * 100) / 100
      : null;

  const statusConfig = {
    running: {
      icon: Loader2,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
      label: "Running...",
      animate: true,
    },
    success: {
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      borderColor: "border-green-500/20",
      label: "Success",
      animate: false,
    },
    error: {
      icon: XCircle,
      color: "text-red-500",
      bgColor: "bg-red-500/10",
      borderColor: "border-red-500/20",
      label: "Error",
      animate: false,
    },
    idle: {
      icon: Clock,
      color: "text-muted-foreground",
      bgColor: "bg-muted",
      borderColor: "border-border",
      label: "Idle",
      animate: false,
    },
  };

  const config = statusConfig[status];
  const StatusIcon = config.icon;

  const outputText = result?.output ? JSON.stringify(result.output, null, 2) : "";

  return (
    <Card className={cn("border", config.borderColor, config.bgColor)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon
              className={cn("h-5 w-5", config.color, config.animate && "animate-spin")}
            />
            <CardTitle className="text-sm font-medium">{config.label}</CardTitle>
          </div>
          {duration !== null && (
            <span className="text-muted-foreground text-xs">{duration}s</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Profile Required Error - special handling */}
        {profileError && (
          <ProfileRequiredErrorView
            error={profileError}
            availableProfiles={availableProfiles}
            profilesLoading={profilesLoading}
            selectedProfileId={selectedProfileId}
            onProfileSelect={setSelectedProfileId}
            onRetry={onRetryWithProfile}
          />
        )}

        {/* Regular error message (only if not a profile error) */}
        {result?.error && !profileError && (
          <div className="rounded-md bg-red-500/10 p-3">
            <p className="text-sm text-red-600 dark:text-red-400">{result.error}</p>
          </div>
        )}

        {/* Output */}
        {result?.output && (
          <div className="group relative">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-muted-foreground text-xs font-medium">Output:</p>
              <CopyButton text={outputText} className="opacity-0 group-hover:opacity-100" />
            </div>
            <pre className="bg-background max-h-64 overflow-auto rounded-md border p-3 text-xs">
              {outputText}
            </pre>
          </div>
        )}

        {/* Run again button (not shown for profile errors, they have their own retry) */}
        {status !== "running" && onReset && !profileError && (
          <button
            onClick={onReset}
            className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
          >
            Run again
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Displays the profile_required error with inline profile selector.
 */
interface ProfileRequiredErrorViewProps {
  error: ProfileRequiredError;
  availableProfiles: Array<{
    id: string;
    name: string;
    is_default: boolean;
    has_resume: boolean;
    resume_name: string | null;
  }>;
  profilesLoading: boolean;
  selectedProfileId: string;
  onProfileSelect: (id: string) => void;
  onRetry?: (profileId: string) => void;
}

function ProfileRequiredErrorView({
  error,
  availableProfiles,
  profilesLoading,
  selectedProfileId,
  onProfileSelect,
  onRetry,
}: ProfileRequiredErrorViewProps) {
  const selectedProfile = availableProfiles.find((p) => p.id === selectedProfileId);
  const hasNoProfiles = availableProfiles.length === 0;

  return (
    <div className="space-y-4">
      {/* Error message */}
      <div className="flex items-start gap-3 rounded-md bg-amber-500/10 p-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
        <p className="text-sm text-amber-600 dark:text-amber-400">{error.message}</p>
      </div>

      {/* No profiles - show CTA to create */}
      {hasNoProfiles && (
        <div className="rounded-lg border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-amber-500/10 p-2">
              <User className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-amber-600 dark:text-amber-400">
                No Job Profiles Found
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create a job profile with your resume to start searching for jobs.
              </p>
              <Link
                href={error.create_profile_url}
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
      )}

      {/* Profile selector */}
      {!hasNoProfiles && (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="profile-select" className="text-sm font-medium">
              Select a profile to continue
            </Label>
            <div className="relative">
              <select
                id="profile-select"
                value={selectedProfileId}
                onChange={(e) => onProfileSelect(e.target.value)}
                disabled={profilesLoading}
                className={cn(
                  "border-input bg-background ring-offset-background",
                  "focus-visible:ring-ring flex h-10 w-full appearance-none rounded-md border pl-3 pr-10 py-2",
                  "text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                  "disabled:cursor-not-allowed disabled:opacity-50"
                )}
              >
                <option value="">Select a profile...</option>
                {availableProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.name}
                    {profile.is_default ? " (default)" : ""}
                    {!profile.has_resume ? " ⚠️ No resume" : ""}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            </div>
          </div>

          {/* Selected profile warning if no resume */}
          {selectedProfile && !selectedProfile.has_resume && (
            <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>This profile has no resume linked. Please add a resume first.</span>
            </div>
          )}

          {/* Selected profile success indicator */}
          {selectedProfile && selectedProfile.has_resume && (
            <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/5 px-3 py-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>Resume: {selectedProfile.resume_name}</span>
            </div>
          )}

          {/* Retry button */}
          <div className="flex items-center gap-3">
            <Button
              onClick={() => selectedProfileId && onRetry?.(selectedProfileId)}
              disabled={!selectedProfileId || (selectedProfile && !selectedProfile.has_resume)}
              size="sm"
            >
              Retry with selected profile
            </Button>
            <Link
              href={error.create_profile_url}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Manage profiles →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

