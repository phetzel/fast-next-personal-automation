"use client";

import React from "react";
import { UserCircle, FileText, BookOpen, FolderOpen } from "lucide-react";

export type TabId = "profiles" | "resumes" | "story" | "projects";

interface TabNavProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "profiles", label: "Profiles", icon: <UserCircle className="h-4 w-4" /> },
  { id: "resumes", label: "Resumes", icon: <FileText className="h-4 w-4" /> },
  { id: "story", label: "Story", icon: <BookOpen className="h-4 w-4" /> },
  { id: "projects", label: "Projects", icon: <FolderOpen className="h-4 w-4" /> },
];

export function TabNav({ activeTab, onTabChange }: TabNavProps) {
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

