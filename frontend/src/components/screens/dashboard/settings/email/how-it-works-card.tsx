import { Card } from "@/components/ui";

const STEPS = [
  {
    title: "Connect your Gmail",
    description: "Grant read-only access to fetch emails from specific senders",
  },
  {
    title: "Automatic syncing",
    description: "Emails are checked hourly and parsed automatically",
  },
  {
    title: "Content extracted",
    description: "Relevant data is extracted and organized in your areas",
  },
];

export function HowItWorksCard() {
  return (
    <Card className="p-6">
      <h2 className="mb-4 text-lg font-semibold">How It Works</h2>
      <div className="space-y-4">
        {STEPS.map((step, index) => (
          <div key={step.title} className="flex items-start gap-3">
            <div className="bg-primary text-primary-foreground flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold">
              {index + 1}
            </div>
            <div>
              <p className="font-medium">{step.title}</p>
              <p className="text-muted-foreground text-sm">{step.description}</p>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
