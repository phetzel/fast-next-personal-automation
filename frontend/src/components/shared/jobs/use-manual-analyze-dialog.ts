"use client";

import { useCallback, useState } from "react";
import type { Job } from "@/types";

interface UseManualAnalyzeDialogOptions {
  onComplete?: (updatedJob: Job) => void;
}

export function useManualAnalyzeDialog(options: UseManualAnalyzeDialogOptions = {}) {
  const { onComplete } = options;
  const [job, setJob] = useState<Job | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback((nextJob: Job) => {
    setJob(nextJob);
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
    setJob(null);
  }, []);

  const complete = useCallback(
    (updatedJob: Job) => {
      setJob(updatedJob);
      onComplete?.(updatedJob);
    },
    [onComplete]
  );

  return {
    job,
    isOpen,
    open,
    close,
    complete,
  };
}
