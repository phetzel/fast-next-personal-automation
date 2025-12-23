"use client";

import { create } from "zustand";
import type { Job, JobFilters, JobStats } from "@/types";

interface JobStore {
  // Job list state
  jobs: Job[];
  total: number;
  isLoading: boolean;
  error: string | null;

  // Filters
  filters: JobFilters;

  // Stats
  stats: JobStats | null;
  statsLoading: boolean;

  // Selected job for detail view
  selectedJob: Job | null;

  // Actions
  setJobs: (jobs: Job[], total: number) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  setFilters: (filters: Partial<JobFilters>) => void;
  resetFilters: () => void;
  setStats: (stats: JobStats | null) => void;
  setStatsLoading: (loading: boolean) => void;
  setSelectedJob: (job: Job | null) => void;
  updateJob: (job: Job) => void;
  removeJob: (jobId: string) => void;
}

const defaultFilters: JobFilters = {
  page: 1,
  page_size: 20,
  sort_by: "created_at",
  sort_order: "desc",
};

export const useJobStore = create<JobStore>((set) => ({
  // Initial state
  jobs: [],
  total: 0,
  isLoading: false,
  error: null,
  filters: defaultFilters,
  stats: null,
  statsLoading: false,
  selectedJob: null,

  // Actions
  setJobs: (jobs, total) => set({ jobs, total, error: null }),

  setLoading: (isLoading) => set({ isLoading }),

  setError: (error) => set({ error }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  resetFilters: () => set({ filters: defaultFilters }),

  setStats: (stats) => set({ stats }),

  setStatsLoading: (statsLoading) => set({ statsLoading }),

  setSelectedJob: (selectedJob) => set({ selectedJob }),

  updateJob: (updatedJob) =>
    set((state) => ({
      jobs: state.jobs.map((job) =>
        job.id === updatedJob.id ? updatedJob : job
      ),
      selectedJob:
        state.selectedJob?.id === updatedJob.id
          ? updatedJob
          : state.selectedJob,
    })),

  removeJob: (jobId) =>
    set((state) => ({
      jobs: state.jobs.filter((job) => job.id !== jobId),
      total: state.total - 1,
      selectedJob: state.selectedJob?.id === jobId ? null : state.selectedJob,
    })),
}));

