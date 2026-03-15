"use client";

import { Toaster } from "sonner";
import { getResolvedTheme, useThemeStore } from "@/stores/theme-store";

export function AppToaster() {
  const theme = useThemeStore((state) => state.theme);

  return <Toaster closeButton richColors theme={getResolvedTheme(theme)} />;
}
