"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { ConfirmDialogProvider } from "@/components/shared/feedback";
import { ThemeProvider } from "@/components/shared/theme";

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ConfirmDialogProvider>{children}</ConfirmDialogProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
