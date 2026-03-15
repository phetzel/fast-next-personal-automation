"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AppToaster, ConfirmDialogProvider } from "@/components/shared/feedback";
import { ThemeProvider } from "@/components/shared/theme";
import { createQueryClient } from "@/lib/query-client";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfirmDialogProvider>
          {children}
          <AppToaster />
        </ConfirmDialogProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
