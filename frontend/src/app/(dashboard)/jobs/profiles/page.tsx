"use client";

import React, { useState, useEffect, useRef } from "react";
import { useJobProfiles, useResumes, useStories, useProjects } from "@/hooks";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Badge,
  Textarea,
} from "@/components/ui";
import { ResumeSelector } from "@/components/jobs";
import type { JobProfile, JobProfileCreate, JobProfileUpdate, ResumeSummary, StorySummary, Story, StoryCreate, StoryUpdate, ProjectSummary } from "@/types";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Star,
  StarOff,
  X,
  Save,
  FileText,
  MapPin,
  Briefcase,
  Upload,
  File,
  AlertCircle,
  CheckCircle2,
  UserCircle,
  BookOpen,
  FolderOpen,
} from "lucide-react";

// Accepted file types for resume upload
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

function getFileIcon(filename: string) {
  if (filename.endsWith(".pdf")) {
    return <FileText className="h-5 w-5 text-red-500" />;
  }
  if (filename.endsWith(".docx")) {
    return <FileText className="h-5 w-5 text-blue-500" />;
  }
  return <File className="h-5 w-5 text-gray-500" />;
}

// ============================================================================
// Tab Navigation
// ============================================================================

type TabId = "profiles" | "resumes" | "story" | "projects";

function TabNav({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (tab: TabId) => void }) {
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "profiles", label: "Profiles", icon: <UserCircle className="h-4 w-4" /> },
    { id: "resumes", label: "Resumes", icon: <FileText className="h-4 w-4" /> },
    { id: "story", label: "Story", icon: <BookOpen className="h-4 w-4" /> },
    { id: "projects", label: "Projects", icon: <FolderOpen className="h-4 w-4" /> },
  ];

  return (
    <div className="flex gap-1 rounded-lg border bg-muted/30 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === tab.id
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ============================================================================
// Profile Components
// ============================================================================

interface ProfileFormData {
  name: string;
  resume_id: string | null;
  story_id: string | null;
  project_ids: string[] | null;
  target_roles: string[] | null;
  target_locations: string[] | null;
  min_score_threshold: number;
}

function ProfileForm({
  profile,
  onSave,
  onCancel,
  isLoading,
}: {
  profile?: JobProfile | null;
  onSave: (data: ProfileFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [name, setName] = useState(profile?.name || "");
  const [resumeId, setResumeId] = useState<string | null>(profile?.resume_id || null);
  const [storyId, setStoryId] = useState<string | null>(profile?.story_id || null);
  const [projectIds, setProjectIds] = useState<string[]>(profile?.project_ids || []);
  const [targetRoles, setTargetRoles] = useState<string[]>(profile?.target_roles || []);
  const [targetLocations, setTargetLocations] = useState<string[]>(
    profile?.target_locations || []
  );
  const [minScore, setMinScore] = useState(profile?.min_score_threshold || 7.0);
  const [newRole, setNewRole] = useState("");
  const [newLocation, setNewLocation] = useState("");

  // Fetch stories and projects for selectors
  const { stories, fetchStories } = useStories();
  const { projects, fetchProjects } = useProjects();

  useEffect(() => {
    fetchStories();
    fetchProjects();
  }, [fetchStories, fetchProjects]);

  const isEditing = !!profile;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const data: ProfileFormData = {
      name,
      resume_id: resumeId,
      story_id: storyId,
      project_ids: projectIds.length > 0 ? projectIds : null,
      target_roles: targetRoles.length > 0 ? targetRoles : null,
      target_locations: targetLocations.length > 0 ? targetLocations : null,
      min_score_threshold: minScore,
    };

    await onSave(data);
  };

  const addRole = () => {
    if (newRole.trim() && !targetRoles.includes(newRole.trim())) {
      setTargetRoles([...targetRoles, newRole.trim()]);
      setNewRole("");
    }
  };

  const removeRole = (role: string) => {
    setTargetRoles(targetRoles.filter((r) => r !== role));
  };

  const addLocation = () => {
    if (newLocation.trim() && !targetLocations.includes(newLocation.trim())) {
      setTargetLocations([...targetLocations, newLocation.trim()]);
      setNewLocation("");
    }
  };

  const removeLocation = (location: string) => {
    setTargetLocations(targetLocations.filter((l) => l !== location));
  };

  const toggleProject = (projectId: string) => {
    if (projectIds.includes(projectId)) {
      setProjectIds(projectIds.filter((id) => id !== projectId));
    } else {
      setProjectIds([...projectIds, projectId]);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Profile" : "Create New Profile"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your job search profile settings"
            : "Create a new job search profile with your resume, story, projects, and preferences"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Profile Name */}
          <div>
            <label className="mb-2 block text-sm font-medium">Profile Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Backend Engineer Profile"
              required
              maxLength={100}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Give this profile a memorable name
            </p>
          </div>

          {/* Resume Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">Resume</label>
            <ResumeSelector
              value={resumeId}
              onChange={setResumeId}
              placeholder="Select a resume for this profile..."
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Link a resume to this profile for AI job matching.
            </p>
          </div>

          {/* Story Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">Story</label>
            <select
              value={storyId || ""}
              onChange={(e) => setStoryId(e.target.value || null)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <option value="">No story selected</option>
              {stories.map((story) => (
                <option key={story.id} value={story.id}>
                  {story.name} {story.is_primary && "(Primary)"}
                </option>
              ))}
            </select>
            <p className="text-muted-foreground mt-1 text-xs">
              Link a story to personalize your job applications.
            </p>
          </div>

          {/* Projects Selector */}
          <div>
            <label className="mb-2 block text-sm font-medium">Projects</label>
            {projects.length > 0 ? (
              <div className="space-y-2 rounded-md border p-3">
                {projects.map((project) => (
                  <label
                    key={project.id}
                    className="flex cursor-pointer items-center gap-3 rounded p-2 hover:bg-muted/50"
                  >
                    <input
                      type="checkbox"
                      checked={projectIds.includes(project.id)}
                      onChange={() => toggleProject(project.id)}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <div className="flex-1">
                      <span className="font-medium">{project.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {project.original_filename}
                      </span>
                    </div>
                    {project.has_text && (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    )}
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">
                No projects yet. Upload projects in the Projects tab.
              </p>
            )}
            <p className="text-muted-foreground mt-1 text-xs">
              Select projects to include in job applications for this profile.
            </p>
          </div>

          {/* Target Roles */}
          <div>
            <label className="mb-2 block text-sm font-medium">Target Roles</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {targetRoles.map((role) => (
                <span
                  key={role}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                >
                  {role}
                  <button
                    type="button"
                    onClick={() => removeRole(role)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newRole}
                onChange={(e) => setNewRole(e.target.value)}
                placeholder="e.g., Backend Engineer"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addRole();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addRole}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Target Locations */}
          <div>
            <label className="mb-2 block text-sm font-medium">Target Locations</label>
            <div className="mb-2 flex flex-wrap gap-2">
              {targetLocations.map((location) => (
                <span
                  key={location}
                  className="bg-secondary text-secondary-foreground inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm"
                >
                  {location}
                  <button
                    type="button"
                    onClick={() => removeLocation(location)}
                    className="hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newLocation}
                onChange={(e) => setNewLocation(e.target.value)}
                placeholder="e.g., Remote or San Francisco, CA"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLocation();
                  }
                }}
              />
              <Button type="button" variant="outline" onClick={addLocation}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Min Score */}
          <div>
            <label className="mb-2 block text-sm font-medium">
              Minimum Score Threshold
            </label>
            <div className="flex items-center gap-4">
              <Input
                type="number"
                value={minScore}
                onChange={(e) => setMinScore(parseFloat(e.target.value) || 7.0)}
                min={0}
                max={10}
                step={0.5}
                className="w-24"
              />
              <span className="text-muted-foreground text-sm">
                Jobs scoring below {minScore} won&apos;t be saved automatically
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Save Changes" : "Create Profile"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ProfileCard({
  profile,
  onEdit,
  onDelete,
  onSetDefault,
  isLoading,
}: {
  profile: JobProfile;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isLoading?: boolean;
}) {
  return (
    <Card className={profile.is_default ? "border-primary/50 ring-1 ring-primary/20" : ""}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-lg font-semibold">{profile.name}</h3>
              {profile.is_default && (
                <Badge variant="default" className="shrink-0">
                  <Star className="mr-1 h-3 w-3" />
                  Default
                </Badge>
              )}
            </div>

            <div className="mt-3 space-y-2">
              {/* Resume status */}
              <div className="flex items-center gap-2 text-sm">
                <FileText className="text-muted-foreground h-4 w-4" />
                {profile.resume ? (
                  <span className="text-green-600">
                    {profile.resume.name}
                    {!profile.resume.has_text && (
                      <span className="ml-1 text-amber-600">(no text)</span>
                    )}
                  </span>
                ) : (
                  <span className="text-muted-foreground">No resume linked</span>
                )}
              </div>

              {/* Story status */}
              <div className="flex items-center gap-2 text-sm">
                <BookOpen className="text-muted-foreground h-4 w-4" />
                {profile.story ? (
                  <span className="text-purple-600">{profile.story.name}</span>
                ) : (
                  <span className="text-muted-foreground">No story linked</span>
                )}
              </div>

              {/* Projects status */}
              <div className="flex items-center gap-2 text-sm">
                <FolderOpen className="text-muted-foreground h-4 w-4" />
                {profile.projects && profile.projects.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {profile.projects.slice(0, 2).map((project) => (
                      <Badge key={project.id} variant="outline" className="text-xs text-blue-600 border-blue-300">
                        {project.name}
                      </Badge>
                    ))}
                    {profile.projects.length > 2 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.projects.length - 2} more
                      </Badge>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No projects linked</span>
                )}
              </div>

              {/* Target roles */}
              {profile.target_roles && profile.target_roles.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <Briefcase className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex flex-wrap gap-1">
                    {profile.target_roles.slice(0, 3).map((role) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                    {profile.target_roles.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.target_roles.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Target locations */}
              {profile.target_locations && profile.target_locations.length > 0 && (
                <div className="flex items-start gap-2 text-sm">
                  <MapPin className="text-muted-foreground mt-0.5 h-4 w-4" />
                  <div className="flex flex-wrap gap-1">
                    {profile.target_locations.slice(0, 3).map((loc) => (
                      <Badge key={loc} variant="outline" className="text-xs">
                        {loc}
                      </Badge>
                    ))}
                    {profile.target_locations.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{profile.target_locations.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Score threshold */}
              <div className="text-muted-foreground text-xs">
                Min score: {profile.min_score_threshold}/10
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex shrink-0 gap-1">
            {!profile.is_default && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSetDefault}
                disabled={isLoading}
                title="Set as default"
              >
                <StarOff className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={onEdit} disabled={isLoading}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={isLoading}
              className="hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProfilesTab() {
  const {
    profiles,
    isLoading,
    error,
    fetchProfiles,
    getProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    setDefault,
  } = useJobProfiles();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingProfile, setEditingProfile] = useState<JobProfile | null>(null);
  const [fullProfiles, setFullProfiles] = useState<Map<string, JobProfile>>(new Map());
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  useEffect(() => {
    const loadFullProfiles = async () => {
      const map = new Map<string, JobProfile>();
      for (const summary of profiles) {
        const full = await getProfile(summary.id);
        if (full) {
          map.set(summary.id, full);
        }
      }
      setFullProfiles(map);
    };

    if (profiles.length > 0) {
      loadFullProfiles();
    }
  }, [profiles, getProfile]);

  const handleCreate = async (data: ProfileFormData) => {
    setIsSubmitting(true);
    const result = await createProfile(data as JobProfileCreate);
    setIsSubmitting(false);
    if (result) {
      setView("list");
    }
  };

  const handleUpdate = async (data: ProfileFormData) => {
    if (!editingProfile) return;
    setIsSubmitting(true);
    const result = await updateProfile(editingProfile.id, data as JobProfileUpdate);
    setIsSubmitting(false);
    if (result) {
      setEditingProfile(null);
      setView("list");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this profile?")) return;
    await deleteProfile(id);
  };

  const handleSetDefault = async (id: string) => {
    await setDefault(id);
  };

  const handleEdit = (profile: JobProfile) => {
    setEditingProfile(profile);
    setView("edit");
  };

  const handleCancel = () => {
    setEditingProfile(null);
    setView("list");
  };

  if (isLoading && profiles.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (view === "create" || view === "edit") {
    return (
      <ProfileForm
        profile={editingProfile}
        onSave={view === "create" ? handleCreate : handleUpdate}
        onCancel={handleCancel}
        isLoading={isSubmitting}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Configure your job search preferences and linked resumes
        </p>
        <Button onClick={() => setView("create")} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Profile
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {profiles.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-purple-500/10 p-4">
              <UserCircle className="h-10 w-10 text-purple-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No Profiles Yet</h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              Create your first job search profile to get started. Link your resume and
              set preferences to help the AI find the best job matches for you.
            </p>
            <Button onClick={() => setView("create")}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Profile
            </Button>
          </CardContent>
        </Card>
      )}

      {profiles.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((summary) => {
            const fullProfile = fullProfiles.get(summary.id);
            if (!fullProfile) {
              return (
                <Card key={summary.id}>
                  <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </CardContent>
                </Card>
              );
            }
            return (
              <ProfileCard
                key={summary.id}
                profile={fullProfile}
                onEdit={() => handleEdit(fullProfile)}
                onDelete={() => handleDelete(summary.id)}
                onSetDefault={() => handleSetDefault(summary.id)}
                isLoading={isLoading}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Resume Components
// ============================================================================

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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && ACCEPTED_TYPES.includes(file.type)) {
      setSelectedFile(file);
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  };

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

      {selectedFile && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              {getFileIcon(selectedFile.name)}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Resume Name</label>
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
        {getFileIcon(resume.original_filename)}
        
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

function ResumesTab() {
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
          <ResumeUploadZone onUpload={handleUpload} isUploading={isUploading} />
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

// ============================================================================
// Story Components
// ============================================================================

interface StoryFormData {
  name: string;
  content: string;
  is_primary: boolean;
}

function StoryForm({
  story,
  onSave,
  onCancel,
  isLoading,
}: {
  story?: Story | null;
  onSave: (data: StoryFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}) {
  const [name, setName] = useState(story?.name || "");
  const [content, setContent] = useState(story?.content || "");
  const isPrimary = story?.is_primary || false;

  const isEditing = !!story;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({ name, content, is_primary: isPrimary });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? "Edit Story" : "Create New Story"}</CardTitle>
        <CardDescription>
          {isEditing
            ? "Update your personal story or narrative"
            : "Write a story about yourself - things you want to emphasize during job applications"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Story Name */}
          <div>
            <label className="mb-2 block text-sm font-medium">Story Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., My Career Journey"
              required
              maxLength={100}
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Give this story a memorable name
            </p>
          </div>

          {/* Story Content */}
          <div>
            <label className="mb-2 block text-sm font-medium">Your Story</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write about yourself... What makes you unique? What are you passionate about? What do you want employers to know?"
              required
              className="min-h-[300px]"
            />
            <p className="text-muted-foreground mt-1 text-xs">
              Markdown is supported. This content will be used to help personalize job applications.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading || !name.trim() || !content.trim()}>
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {isEditing ? "Save Changes" : "Create Story"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function StoryListItem({
  story,
  onEdit,
  onDelete,
  onSetPrimary,
  isLoading,
}: {
  story: StorySummary;
  onEdit: () => void;
  onDelete: () => void;
  onSetPrimary: () => void;
  isLoading?: boolean;
}) {
  return (
    <Card className={story.is_primary ? "border-primary/50 ring-1 ring-primary/20" : ""}>
      <CardContent className="flex items-start gap-4 py-4">
        <BookOpen className="mt-1 h-5 w-5 text-purple-500" />
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{story.name}</p>
            {story.is_primary && (
              <Badge variant="default" className="shrink-0">
                <Star className="mr-1 h-3 w-3" />
                Primary
              </Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {story.content_preview}
          </p>
        </div>

        <div className="flex shrink-0 gap-1">
          {!story.is_primary && (
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
          <Button variant="ghost" size="sm" onClick={onEdit} disabled={isLoading}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="hover:text-destructive"
            title="Delete story"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function StoryTab() {
  const {
    stories,
    isLoading,
    error,
    fetchStories,
    getStory,
    createStory,
    updateStory,
    deleteStory,
    setPrimary,
  } = useStories();

  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  const handleCreate = async (data: StoryFormData) => {
    setIsSubmitting(true);
    const result = await createStory(data as StoryCreate);
    setIsSubmitting(false);
    if (result) {
      setView("list");
    }
  };

  const handleUpdate = async (data: StoryFormData) => {
    if (!editingStory) return;
    setIsSubmitting(true);
    const result = await updateStory(editingStory.id, data as StoryUpdate);
    setIsSubmitting(false);
    if (result) {
      setEditingStory(null);
      setView("list");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this story?")) return;
    await deleteStory(id);
  };

  const handleSetPrimary = async (id: string) => {
    await setPrimary(id);
  };

  const handleEdit = async (storySummary: StorySummary) => {
    const fullStory = await getStory(storySummary.id);
    if (fullStory) {
      setEditingStory(fullStory);
      setView("edit");
    }
  };

  const handleCancel = () => {
    setEditingStory(null);
    setView("list");
  };

  if (isLoading && stories.length === 0) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="text-muted-foreground h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (view === "create" || view === "edit") {
    return (
      <StoryForm
        story={editingStory}
        onSave={view === "create" ? handleCreate : handleUpdate}
        onCancel={handleCancel}
        isLoading={isSubmitting}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with create button */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Write personal narratives to emphasize during job applications
        </p>
        <Button onClick={() => setView("create")} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          New Story
        </Button>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {stories.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 rounded-full bg-purple-500/10 p-4">
              <BookOpen className="h-10 w-10 text-purple-600" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No Stories Yet</h2>
            <p className="text-muted-foreground mb-4 max-w-md">
              Write your first story to share what makes you unique. This helps
              personalize your job applications.
            </p>
            <Button onClick={() => setView("create")}>
              <Plus className="mr-2 h-4 w-4" />
              Write Your First Story
            </Button>
          </CardContent>
        </Card>
      )}

      {stories.length > 0 && (
        <div className="space-y-2">
          {stories.map((story) => (
            <StoryListItem
              key={story.id}
              story={story}
              onEdit={() => handleEdit(story)}
              onDelete={() => handleDelete(story.id)}
              onSetPrimary={() => handleSetPrimary(story.id)}
              isLoading={isLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Projects Components
// ============================================================================

// Accepted file extensions for project uploads
const PROJECT_ACCEPTED_EXTENSIONS = ".md,.txt";

function ProjectUploadZone({
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".md") || file.name.endsWith(".txt"))) {
      setSelectedFile(file);
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const defaultName = file.name.replace(/\.[^/.]+$/, "");
      setName(defaultName);
    }
  };

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
          accept={PROJECT_ACCEPTED_EXTENSIONS}
          onChange={handleFileSelect}
          className="hidden"
        />
        <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 text-sm font-medium">Drop a file here or click to browse</p>
        <p className="text-xs text-muted-foreground">Markdown (.md) or Text (.txt) files (max 5MB)</p>
      </div>

      {selectedFile && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-start gap-4">
              <FileText className="h-5 w-5 text-blue-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(selectedFile.size)}
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Project Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., E-commerce Platform"
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

function ProjectListItem({
  project,
  onDelete,
  isLoading,
}: {
  project: ProjectSummary;
  onDelete: () => void;
  isLoading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 py-4">
        <FolderOpen className="h-5 w-5 text-blue-500" />
        
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-medium">{project.name}</p>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {project.original_filename}
          </p>
          <div className="mt-1 flex items-center gap-2 text-xs">
            {project.has_text ? (
              <span className="flex items-center gap-1 text-green-600">
                <CheckCircle2 className="h-3 w-3" />
                Content loaded
              </span>
            ) : (
              <span className="flex items-center gap-1 text-amber-600">
                <AlertCircle className="h-3 w-3" />
                No content
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={onDelete}
            disabled={isLoading}
            className="hover:text-destructive"
            title="Delete project"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ProjectsTab() {
  const {
    projects,
    isLoading,
    error,
    fetchProjects,
    uploadProject,
    deleteProject,
  } = useProjects();

  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleUpload = async (file: File, name: string) => {
    setIsUploading(true);
    await uploadProject(file, name);
    setIsUploading(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    await deleteProject(id);
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Project</CardTitle>
          <CardDescription>
            Upload project descriptions in Markdown or text format. Multiple projects
            can be active at the same time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectUploadZone onUpload={handleUpload} isUploading={isUploading} />
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="py-4">
            <p className="text-destructive text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {isLoading && projects.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {projects.length > 0 && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Your Projects</h2>
            <span className="text-sm text-muted-foreground">
              {projects.length} project{projects.length !== 1 ? "s" : ""}
            </span>
          </div>
          <p className="mb-3 text-sm text-muted-foreground">
            Link projects to profiles in the Profiles tab to use them in job applications.
          </p>
          <div className="space-y-2">
            {projects.map((project) => (
              <ProjectListItem
                key={project.id}
                project={project}
                onDelete={() => handleDelete(project.id)}
                isLoading={isLoading}
              />
            ))}
          </div>
        </div>
      )}

      {!isLoading && projects.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
            <h3 className="mt-4 font-semibold">No Projects Yet</h3>
            <p className="text-sm text-muted-foreground">
              Upload your first project description to showcase your work.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ============================================================================
// Main Page Component
// ============================================================================

export default function ProfilesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profiles");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Profiles & Materials</h1>
        <p className="text-muted-foreground">
          Manage your job search profiles, resumes, stories, and projects
        </p>
      </div>

      {/* Tab Navigation */}
      <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Tab Content */}
      {activeTab === "profiles" && <ProfilesTab />}
      {activeTab === "resumes" && <ResumesTab />}
      {activeTab === "story" && <StoryTab />}
      {activeTab === "projects" && <ProjectsTab />}
    </div>
  );
}
