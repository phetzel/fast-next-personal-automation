import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui";
import { Briefcase, Sparkles } from "lucide-react";
import type { JobDetailTabId } from "./use-job-detail-screen";

const TABS: Array<{ id: JobDetailTabId; label: string; icon: typeof Briefcase }> = [
  { id: "overview", label: "Job Details", icon: Briefcase },
  { id: "prep", label: "Prep Materials", icon: Sparkles },
];

interface JobDetailTabsProps {
  activeTab: JobDetailTabId;
  hasPreppedMaterials: boolean;
  onTabChange: (tab: JobDetailTabId) => void;
  overviewContent: ReactNode;
  prepContent: ReactNode;
}

export function JobDetailTabs({
  activeTab,
  hasPreppedMaterials,
  onTabChange,
  overviewContent,
  prepContent,
}: JobDetailTabsProps) {
  return (
    <Tabs value={activeTab} onValueChange={(value) => onTabChange(value as JobDetailTabId)}>
      <TabsList className="flex gap-6">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const showBadge = tab.id === "prep" && hasPreppedMaterials;

          return (
            <TabsTrigger key={tab.id} value={tab.id} className="flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {tab.label}
              {showBadge && (
                <span
                  className="flex h-2 w-2 rounded-full bg-cyan-500"
                  aria-label="Has prep materials"
                />
              )}
            </TabsTrigger>
          );
        })}
      </TabsList>
      <TabsContent value="overview" className="min-h-[400px] pt-6">
        {overviewContent}
      </TabsContent>
      <TabsContent value="prep" className="min-h-[400px] pt-6">
        {prepContent}
      </TabsContent>
    </Tabs>
  );
}
