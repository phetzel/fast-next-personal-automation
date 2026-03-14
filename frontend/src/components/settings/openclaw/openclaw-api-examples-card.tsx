import { Badge, Card, CardContent, CardDescription, CardHeader, CardTitle, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Separator } from "@/components/ui";

import {
  getOpenClawExampleOptions,
  type OpenClawExampleValue,
} from "./constants";

interface OpenClawApiExamplesCardProps {
  exampleToken: string;
  selectedExample: OpenClawExampleValue;
  onSelectedExampleChange: (value: OpenClawExampleValue) => void;
}

export function OpenClawApiExamplesCard({
  exampleToken,
  selectedExample,
  onSelectedExampleChange,
}: OpenClawApiExamplesCardProps) {
  const exampleOptions = getOpenClawExampleOptions(exampleToken);
  const activeExample = exampleOptions.find((option) => option.value === selectedExample)!;

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Examples</CardTitle>
        <CardDescription>
          Use the backend API origin for `$APP_API_BASE_URL`, not the Next.js frontend proxy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="example-selector">Example</Label>
          <Select value={selectedExample} onValueChange={onSelectedExampleChange}>
            <SelectTrigger id="example-selector">
              <SelectValue placeholder="Select an API example" />
            </SelectTrigger>
            <SelectContent>
              {exampleOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="rounded-lg border">
          <div className="flex flex-col gap-2 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{activeExample.label}</Badge>
              <span className="text-muted-foreground font-mono text-xs">{activeExample.route}</span>
            </div>
            <p className="text-muted-foreground text-sm">{activeExample.description}</p>
          </div>
          <Separator />
          <pre className="bg-muted/40 overflow-x-auto p-4 text-xs leading-6">
            {activeExample.example}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}
