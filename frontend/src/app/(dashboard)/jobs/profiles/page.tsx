"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shared/layout";
import {
  ProfilesTab,
  ResumesTab,
  StoryTab,
  ProjectsTab,
  type TabId,
} from "@/components/screens/dashboard/jobs/profiles";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";

export default function ProfilesPage() {
  const [activeTab, setActiveTab] = useState<TabId>("profiles");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Profiles & Materials"
        description="Manage your job search profiles, resumes, stories, and projects"
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabId)}>
        <TabsList className="-mb-px flex gap-4">
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
          <TabsTrigger value="resumes">Resumes</TabsTrigger>
          <TabsTrigger value="story">Stories</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
        </TabsList>
        <TabsContent value="profiles" className="pt-6">
          <ProfilesTab />
        </TabsContent>
        <TabsContent value="resumes" className="pt-6">
          <ResumesTab />
        </TabsContent>
        <TabsContent value="story" className="pt-6">
          <StoryTab />
        </TabsContent>
        <TabsContent value="projects" className="pt-6">
          <ProjectsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
