import { Button } from "@/components/ui";
import type { EmailSource } from "@/types";
import { Mail } from "lucide-react";

interface MessageSourceSelectorProps {
  sources: EmailSource[];
  selectedSource: EmailSource | null;
  onSelectSource: (source: EmailSource) => void;
}

export function MessageSourceSelector({
  sources,
  selectedSource,
  onSelectSource,
}: MessageSourceSelectorProps) {
  if (sources.length <= 1) {
    return null;
  }

  return (
    <div className="flex gap-2">
      {sources.map((source) => (
        <Button
          key={source.id}
          variant={selectedSource?.id === source.id ? "default" : "outline"}
          size="sm"
          onClick={() => onSelectSource(source)}
        >
          <Mail className="mr-2 h-4 w-4" />
          {source.email_address}
        </Button>
      ))}
    </div>
  );
}
