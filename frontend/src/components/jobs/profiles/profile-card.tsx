"use client";

import { Button, Card, CardContent, Badge } from "@/components/ui";
import type { JobProfile } from "@/types";
import {
  Pencil,
  Trash2,
  Star,
  StarOff,
  FileText,
  MapPin,
  Briefcase,
  BookOpen,
  FolderOpen,
} from "lucide-react";

interface ProfileCardProps {
  profile: JobProfile;
  onEdit: () => void;
  onDelete: () => void;
  onSetDefault: () => void;
  isLoading?: boolean;
}

export function ProfileCard({
  profile,
  onEdit,
  onDelete,
  onSetDefault,
  isLoading,
}: ProfileCardProps) {
  return (
    <Card className={profile.is_default ? "border-primary/50 ring-primary/20 ring-1" : ""}>
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
                      <Badge
                        key={project.id}
                        variant="outline"
                        className="border-blue-300 text-xs text-blue-600"
                      >
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
