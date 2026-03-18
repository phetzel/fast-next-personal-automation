import type { JobStatus } from "@/types";
import { JOB_STATUSES } from "@/types";

export function getNextSelectedStatuses(
  selectedStatuses: JobStatus[],
  toggledStatus: JobStatus
): JobStatus[] {
  const nextStatuses = JOB_STATUSES.filter((status) =>
    status === toggledStatus
      ? !selectedStatuses.includes(toggledStatus)
      : selectedStatuses.includes(status)
  );

  return nextStatuses.length > 0 ? nextStatuses : selectedStatuses;
}
