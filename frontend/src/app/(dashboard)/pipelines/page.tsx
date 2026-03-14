"use client";

import { useState } from "react";
import { PipelineList, PipelineRunHistory } from "@/components/shared/pipelines";
import { PageHeader } from "@/components/shared/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { Workflow, History } from "lucide-react";

type TabType = "pipelines" | "history";

export default function PipelinesPage() {
  const [activeTab, setActiveTab] = useState<TabType>("pipelines");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pipelines"
        description="Run automation pipelines and track their execution history."
      />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)}>
        <TabsList className="-mb-px flex gap-4">
          <TabsTrigger value="pipelines" className="flex items-center gap-2">
            <Workflow className="h-4 w-4" />
            Available Pipelines
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            Run History
          </TabsTrigger>
        </TabsList>
        <TabsContent value="pipelines" className="pt-6">
          <PipelineList />
        </TabsContent>
        <TabsContent value="history" className="pt-6">
          <PipelineRunHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
