import { Combobox } from "@/components/shared/forms";
import { Label } from "@/components/ui";
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
  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="message-source-selector">Email source</Label>
      <Combobox
        triggerId="message-source-selector"
        value={selectedSource?.id ?? ""}
        onValueChange={(value) => {
          const nextSource = sources.find((source) => source.id === value);
          if (nextSource) {
            onSelectSource(nextSource);
          }
        }}
        options={sources.map((source) => ({
          value: source.id,
          label: source.email_address,
          keywords: [source.email_address, source.provider],
        }))}
        placeholder="Select an email source..."
        searchPlaceholder="Search email sources..."
        renderValue={(option) =>
          option ? (
            <span className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4" />
              {option.label}
            </span>
          ) : (
            "Select an email source..."
          )
        }
        renderOption={(option) => (
          <span className="inline-flex items-center gap-2">
            <Mail className="h-4 w-4" />
            {option.label}
          </span>
        )}
        className="justify-between"
      />
    </div>
  );
}
