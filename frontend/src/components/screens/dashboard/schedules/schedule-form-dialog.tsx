import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@/components/ui";
import type { PipelineInfo, ScheduledTask, ScheduledTaskCreate } from "@/types";
import { EVENT_COLORS, describeCron } from "./schedule-utils";

interface ScheduleFormDialogProps {
  open: boolean;
  editingTask: ScheduledTask | null;
  formData: ScheduledTaskCreate;
  pipelines: PipelineInfo[];
  isLoading: boolean;
  setOpen: (open: boolean) => void;
  setFormData: (data: ScheduledTaskCreate) => void;
  onSubmit: () => void;
}

export function ScheduleFormDialog({
  open,
  editingTask,
  formData,
  pipelines,
  isLoading,
  setOpen,
  setFormData,
  onSubmit,
}: ScheduleFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{editingTask ? "Edit Schedule" : "Create Schedule"}</DialogTitle>
          <DialogDescription>
            {editingTask
              ? "Update the scheduled task settings"
              : "Schedule a pipeline to run automatically"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="Daily job prep review"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="Optional description"
              value={formData.description || ""}
              onChange={(event) => setFormData({ ...formData, description: event.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="pipeline">Pipeline *</Label>
            <Select
              value={formData.pipeline_name}
              onValueChange={(value) => setFormData({ ...formData, pipeline_name: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a pipeline" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.name} value={pipeline.name}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cron">Cron Expression *</Label>
            <Input
              id="cron"
              placeholder="0 9 * * 1"
              value={formData.cron_expression}
              onChange={(event) =>
                setFormData({ ...formData, cron_expression: event.target.value })
              }
              className="font-mono"
            />
            {describeCron(formData.cron_expression) ? (
              <p className="text-xs text-emerald-600 dark:text-emerald-400">
                {describeCron(formData.cron_expression)}
              </p>
            ) : (
              <p className="text-muted-foreground text-xs">
                Format: minute hour day-of-month month day-of-week (e.g., <code>0 9 * * 1</code> =
                every Monday at 9am)
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select
              value={formData.timezone}
              onValueChange={(value) => setFormData({ ...formData, timezone: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/Los_Angeles">Pacific Time</SelectItem>
                <SelectItem value="America/Denver">Mountain Time</SelectItem>
                <SelectItem value="America/Chicago">Central Time</SelectItem>
                <SelectItem value="America/New_York">Eastern Time</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex gap-2">
              {EVENT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`h-8 w-8 rounded-full border-2 transition-all ${
                    formData.color === color ? "border-foreground scale-110" : "border-transparent"
                  }`}
                  style={{
                    backgroundColor: `var(--color-${color}-500, #${
                      color === "sky"
                        ? "0ea5e9"
                        : color === "amber"
                          ? "f59e0b"
                          : color === "violet"
                            ? "8b5cf6"
                            : color === "rose"
                              ? "f43f5e"
                              : color === "emerald"
                                ? "10b981"
                                : "f97316"
                    })`,
                  }}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="enabled">Enabled</Label>
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isLoading}>
            {editingTask ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
