"use client";

import { StatusAlert } from "@/components/shared/feedback";
import { PageHeader } from "@/components/shared/layout";
import {
  ScheduleCalendarPanel,
  ScheduleFormDialog,
  ScheduledTaskList,
  SystemTaskList,
  useSchedulesScreen,
} from "@/components/screens/dashboard/schedules";
import { Button } from "@/components/ui";
import { AlertCircle, Plus } from "lucide-react";

export default function SchedulesPage() {
  const screen = useSchedulesScreen();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedules"
        description="Schedule pipelines to run automatically on a recurring basis"
        actions={
          <Button onClick={screen.openNewScheduleDialog}>
            <Plus className="mr-2 h-4 w-4" />
            New Schedule
          </Button>
        }
      />

      {screen.error && (
        <StatusAlert icon={AlertCircle} variant="destructive">
          {screen.error}
        </StatusAlert>
      )}

      <ScheduleCalendarPanel
        events={screen.calendarEvents}
        onDateChange={screen.setCurrentDate}
        onCreateEvent={screen.handleCalendarCreate}
        onSelectEvent={screen.handleCalendarSelect}
        onDeleteEvent={screen.handleEventDelete}
      />

      <ScheduledTaskList
        schedules={screen.schedules}
        isLoading={screen.isLoading}
        onCreate={screen.openNewScheduleDialog}
        onToggle={screen.handleToggle}
        onEdit={screen.handleEdit}
        onDelete={screen.handleDelete}
      />

      <SystemTaskList systemTasks={screen.systemTasks} />

      <ScheduleFormDialog
        open={screen.isDialogOpen}
        editingTask={screen.editingTask}
        formData={screen.formData}
        pipelines={screen.pipelines}
        isLoading={screen.isLoading}
        setOpen={(open) => {
          if (open) {
            return;
          }
          screen.closeScheduleDialog();
        }}
        setFormData={screen.setFormData}
        onSubmit={screen.handleSubmit}
      />
    </div>
  );
}
