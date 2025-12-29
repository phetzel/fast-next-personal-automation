"use client";

import { useState } from "react";
import {
  TabNav,
  ProfilesTab,
  ResumesTab,
  StoryTab,
  ProjectsTab,
  type TabId,
} from "@/components/jobs/profiles";

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
