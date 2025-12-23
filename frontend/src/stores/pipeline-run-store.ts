"use client";

import { create } from "zustand";
import type {
  PipelineRun,
  PipelineRunStats,
  PipelineRunFilters,
} from "@/types";

interface PipelineRunStore {
  // Run list state
  runs: PipelineRun[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;

  // Current filters
  filters: PipelineRunFilters;

  // Stats
  stats: PipelineRunStats | null;
  statsLoading: boolean;

  // Selected run for detail view
  selectedRun: PipelineRun | null;

  // Actions
  setRuns: (runs: PipelineRun[], total: number, page: number, hasMore: boolean) => void;
  appendRuns: (runs: PipelineRun[], total: number, hasMore: boolean) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<PipelineRunFilters>) => void;
  resetFilters: () => void;
  setStats: (stats: PipelineRunStats) => void;
  setStatsLoading: (loading: boolean) => void;
  setSelectedRun: (run: PipelineRun | null) => void;
  setPage: (page: number) => void;
  setPageSize: (pageSize: number) => void;
}

const defaultFilters: PipelineRunFilters = {
  page: 1,
  page_size: 20,
};

export const usePipelineRunStore = create<PipelineRunStore>((set, get) => ({
  // Initial state
  runs: [],
  total: 0,
  page: 1,
  pageSize: 20,
  hasMore: false,
  isLoading: false,
  error: null,
  filters: defaultFilters,
  stats: null,
  statsLoading: false,
  selectedRun: null,

  // Actions
  setRuns: (runs, total, page, hasMore) =>
    set({ runs, total, page, hasMore, error: null }),

  appendRuns: (newRuns, total, hasMore) =>
    set((state) => ({
      runs: [...state.runs, ...newRuns],
      total,
      hasMore,
      page: state.page + 1,
    })),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters, page: 1 },
      page: 1,
    })),

  resetFilters: () =>
    set({
      filters: defaultFilters,
      page: 1,
    }),

  setStats: (stats) => set({ stats }),

  setStatsLoading: (statsLoading) => set({ statsLoading }),

  setSelectedRun: (selectedRun) => set({ selectedRun }),

  setPage: (page) =>
    set((state) => ({
      page,
      filters: { ...state.filters, page },
    })),

  setPageSize: (pageSize) =>
    set((state) => ({
      pageSize,
      page: 1,
      filters: { ...state.filters, page_size: pageSize, page: 1 },
    })),
}));

