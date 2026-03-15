import { describeCron } from "@/components/screens/dashboard/schedules/schedule-utils";
import { formatDateTime } from "@/lib/formatters";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { SystemTask } from "@/types";
import { Lock } from "lucide-react";

interface SystemTaskListProps {
  systemTasks: SystemTask[];
}

export function SystemTaskList({ systemTasks }: SystemTaskListProps) {
  if (systemTasks.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="text-muted-foreground h-5 w-5" />
          System Tasks
        </CardTitle>
        <CardDescription>
          Automated tasks managed by the system - not user-configurable
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {systemTasks.map((task) => (
            <div
              key={task.id}
              className="bg-muted/30 flex items-center justify-between rounded-lg border border-dashed p-4"
            >
              <div className="flex items-center gap-4">
                <Lock className="text-muted-foreground/60 h-4 w-4 shrink-0" />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground font-medium">{task.name}</span>
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs">
                      System
                    </span>
                  </div>
                  <div className="text-muted-foreground/70 mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                    <span>{describeCron(task.cron_expression) ?? task.cron_expression}</span>
                    <span>|</span>
                    <span>{task.timezone}</span>
                    {task.next_run_at && (
                      <>
                        <span>|</span>
                        <span>Next: {formatDateTime(task.next_run_at)}</span>
                      </>
                    )}
                  </div>
                  <p className="text-muted-foreground/60 mt-1 text-xs">{task.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
