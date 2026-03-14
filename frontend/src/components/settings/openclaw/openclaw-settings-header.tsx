import { KeyRound } from "lucide-react";

export function OpenClawSettingsHeader() {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <KeyRound className="h-8 w-8" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">OpenClaw Integration</h1>
          <p className="text-muted-foreground">Create a scoped machine token for OpenClaw.</p>
        </div>
      </div>
    </div>
  );
}
