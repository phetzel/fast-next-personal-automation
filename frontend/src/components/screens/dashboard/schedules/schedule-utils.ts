import cronstrue from "cronstrue";
import type { EventColor } from "@/components/screens/dashboard/schedules/event-calendar";

export const EVENT_COLORS: EventColor[] = ["sky", "amber", "violet", "rose", "emerald", "orange"];

export function describeCron(expression: string): string | null {
  try {
    return cronstrue.toString(expression, { verbose: true });
  } catch {
    return null;
  }
}
