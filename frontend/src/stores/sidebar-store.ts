"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidebarState {
  // Mobile sheet state
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  // Collapsed areas state (persisted)
  collapsedAreas: Record<string, boolean>;
  toggleArea: (areaId: string) => void;
  isAreaCollapsed: (areaId: string) => boolean;
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      // Mobile sheet state
      isOpen: false,
      open: () => set({ isOpen: true }),
      close: () => set({ isOpen: false }),
      toggle: () => set((state) => ({ isOpen: !state.isOpen })),

      // Collapsed areas state
      collapsedAreas: {},
      toggleArea: (areaId: string) =>
        set((state) => ({
          collapsedAreas: {
            ...state.collapsedAreas,
            [areaId]: !state.collapsedAreas[areaId],
          },
        })),
      isAreaCollapsed: (areaId: string) => get().collapsedAreas[areaId] ?? false,
    }),
    {
      name: "sidebar-storage",
      // Only persist collapsedAreas, not the mobile sheet state
      partialize: (state) => ({ collapsedAreas: state.collapsedAreas }),
    }
  )
);
