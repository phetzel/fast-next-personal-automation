import { Accordion } from "@/components/ui";
import type { EmailSync } from "@/types";
import { SyncHistoryItem } from "./sync-history-item";

interface SyncHistoryListProps {
  syncs: EmailSync[];
  selectedSyncId: string;
  onSelectSync: (value: string) => void;
}

export function SyncHistoryList({ syncs, selectedSyncId, onSelectSync }: SyncHistoryListProps) {
  return (
    <Accordion
      type="single"
      value={selectedSyncId}
      onValueChange={onSelectSync}
      collapsible
      className="space-y-3"
    >
      {syncs.map((sync) => (
        <SyncHistoryItem key={sync.id} sync={sync} isSelected={selectedSyncId === sync.id} />
      ))}
    </Accordion>
  );
}
