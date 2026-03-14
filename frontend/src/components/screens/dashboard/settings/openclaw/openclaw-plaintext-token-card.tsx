import { Copy } from "lucide-react";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { OpenClawTokenCreateResponse } from "@/types";

interface OpenClawPlaintextTokenCardProps {
  copied: boolean;
  createdToken: OpenClawTokenCreateResponse;
  onCopy: () => void;
}

export function OpenClawPlaintextTokenCard({
  copied,
  createdToken,
  onCopy,
}: OpenClawPlaintextTokenCardProps) {
  return (
    <Card className="border-green-500/40">
      <CardHeader>
        <CardTitle>Plaintext Token</CardTitle>
        <CardDescription>
          This value is shown once. Put it into OpenClaw as `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN`.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted rounded-lg border p-4 font-mono text-sm break-all">
          {createdToken.token}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button onClick={onCopy} type="button" variant="secondary">
            <Copy className="h-4 w-4" />
            {copied ? "Copied" : "Copy token"}
          </Button>
          <span className="text-muted-foreground text-sm">
            Token name: {createdToken.token_info.name}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
