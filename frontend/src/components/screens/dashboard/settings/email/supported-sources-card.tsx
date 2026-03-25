import { Card } from "@/components/ui";
import type { EmailConfig } from "@/types";
import { Globe } from "lucide-react";

interface SupportedSourcesCardProps {
  config: EmailConfig;
}

export function SupportedSourcesCard({ config }: SupportedSourcesCardProps) {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">Supported Email Sources</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        A default sync schedule is created when you connect Gmail. Messages from these senders are
        parsed when that schedule runs, and you can adjust the cadence on the Schedules page. The
        default interval is every {config.sync_interval_minutes} minutes.
      </p>
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {config.default_senders.map((sender) => (
          <div key={sender.domain} className="flex items-center gap-3 rounded-lg border p-3">
            <Globe className="text-muted-foreground h-5 w-5" />
            <div>
              <span className="font-medium">{sender.display_name}</span>
              <p className="text-muted-foreground text-xs">{sender.domain}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
