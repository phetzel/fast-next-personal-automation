import {
  EventCalendar,
  type CalendarEvent,
} from "@/components/screens/dashboard/schedules/event-calendar";
import { Card, CardContent, CardHeader } from "@/components/ui";

interface ScheduleCalendarPanelProps {
  events: CalendarEvent[];
  onDateChange: (date: Date) => void;
  onCreateEvent: () => void;
  onSelectEvent: (event: CalendarEvent) => void;
  onDeleteEvent: (eventId: string) => void;
}

export function ScheduleCalendarPanel({
  events,
  onDateChange,
  onCreateEvent,
  onSelectEvent,
  onDeleteEvent,
}: ScheduleCalendarPanelProps) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="text-muted-foreground flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="bg-muted-foreground/60 inline-block h-2.5 w-2.5 rounded-full" />
            Past runs (colored by task or status)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-400 opacity-60" />
            Upcoming scheduled runs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-rose-400" />
            Recurring expenses
          </span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[600px]">
          <EventCalendar
            events={events}
            onEventDelete={onDeleteEvent}
            onDateChange={onDateChange}
            onCreateEvent={onCreateEvent}
            onSelectEvent={onSelectEvent}
            initialView="month"
          />
        </div>
      </CardContent>
    </Card>
  );
}
