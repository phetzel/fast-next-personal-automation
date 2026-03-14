import { describeCron } from "@/components/screens/dashboard/schedules/schedule-utils";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui";
import type { ScheduledTask } from "@/types";
import { Calendar, Clock, Edit2, PauseCircle, PlayCircle, Plus, Trash2 } from "lucide-react";

interface ScheduledTaskListProps {
  schedules: ScheduledTask[];
  isLoading: boolean;
  onCreate: () => void;
  onToggle: (task: ScheduledTask) => void;
  onEdit: (task: ScheduledTask) => void;
  onDelete: (task: ScheduledTask) => void;
}

export function ScheduledTaskList({
  schedules,
  isLoading,
  onCreate,
  onToggle,
  onEdit,
  onDelete,
}: ScheduledTaskListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Scheduled Tasks
        </CardTitle>
        <CardDescription>
          {schedules.length} scheduled task{schedules.length !== 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && schedules.length === 0 ? (
          <div className="flex justify-center py-8">
            <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
          </div>
        ) : schedules.length === 0 ? (
          <div className="py-8 text-center">
            <Calendar className="text-muted-foreground/50 mx-auto h-12 w-12" />
            <p className="text-muted-foreground mt-4">No scheduled tasks yet</p>
            <Button className="mt-4" onClick={onCreate} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Create your first schedule
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {schedules.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: task.color
                        ? `var(--color-${task.color}-500, #0ea5e9)`
                        : "#0ea5e9",
                    }}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{task.name}</span>
                      <span
                        className={
                          task.enabled
                            ? "bg-primary text-primary-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                            : "bg-muted text-muted-foreground inline-flex items-center rounded-full px-2 py-0.5 text-xs"
                        }
                      >
                        {task.enabled ? "Active" : "Paused"}
                      </span>
                    </div>
                    <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span>{describeCron(task.cron_expression) ?? task.cron_expression}</span>
                      <span>|</span>
                      <span>{task.pipeline_name}</span>
                      {task.next_run_at && (
                        <>
                          <span>|</span>
                          <span>Next: {new Date(task.next_run_at).toLocaleString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onToggle(task)}
                    title={task.enabled ? "Pause" : "Enable"}
                  >
                    {task.enabled ? (
                      <PauseCircle className="h-4 w-4" />
                    ) : (
                      <PlayCircle className="h-4 w-4" />
                    )}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onEdit(task)} title="Edit">
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(task)} title="Delete">
                    <Trash2 className="text-destructive h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
