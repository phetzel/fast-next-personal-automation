"use client";

import { useState, useEffect } from "react";
import { useProjects } from "@/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import { FileUploadZone } from "@/components/shared";
import { ProjectListItem } from "./project-list-item";
import { PROJECT_ACCEPTED_TYPES, PROJECT_ACCEPTED_EXTENSIONS } from "@/lib/file-utils";
import { Loader2, FolderOpen } from "lucide-react";

export function ProjectsTab() {
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
          <FileUploadZone
            onUpload={handleUpload}
            isUploading={isUploading}
            acceptedTypes={PROJECT_ACCEPTED_TYPES}
            acceptedExtensions={PROJECT_ACCEPTED_EXTENSIONS}
            maxSizeLabel="max 5MB"
            nameLabel="Project Name"
            namePlaceholder="e.g., E-commerce Platform"
            acceptedTypesLabel="Markdown (.md) or Text (.txt)"
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

