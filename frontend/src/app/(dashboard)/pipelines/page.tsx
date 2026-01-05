"use client";

import { useState } from "react";
import { PipelineList, PipelineRunHistory } from "@/components/pipelines";
import { Button } from "@/components/ui";
import { Workflow, History } from "lucide-react";
import { cn } from "@/lib/utils";

type TabType = "pipelines" | "history";

export default function PipelinesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("pipelines");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Pipelines</h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Run automation pipelines and track their execution history.
        </p>
      </div>

      {/* Tab navigation */}
      <div className="border-b">
        <nav className="-mb-px flex gap-4">
          <button
            onClick={() => setActiveTab("pipelines")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors",
              activeTab === "pipelines"
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 border-transparent"
            )}
          >
            <Workflow className="h-4 w-4" />
            Available Pipelines
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-2 border-b-2 px-1 py-3 text-sm font-medium transition-colors",
              activeTab === "history"
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 border-transparent"
            )}
          >
            <History className="h-4 w-4" />
            Run History
          </button>
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "pipelines" ? <PipelineList /> : <PipelineRunHistory />}
    </div>
  );
}
