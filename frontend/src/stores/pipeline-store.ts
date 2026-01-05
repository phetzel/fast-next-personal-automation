"use client";

import { create } from "zustand";
import type {
  PipelineInfo,
  PipelineExecuteResponse,
  ExecutionState,
  ExecutionStatus,
} from "@/types";

interface PipelineStore {
  // Pipeline list
  pipelines: PipelineInfo[];
  isLoading: boolean;
  error: string | null;

  // Execution states per pipeline
  executions: Record<string, ExecutionState>;

  // Actions
  setPipelines: (pipelines: PipelineInfo[]) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;

  // Execution actions
  startExecution: (pipelineName: string, input?: Record<string, unknown>) => void;
  completeExecution: (pipelineName: string, result: PipelineExecuteResponse) => void;
  failExecution: (pipelineName: string, error: string) => void;
  resetExecution: (pipelineName: string) => void;
  getExecutionState: (pipelineName: string) => ExecutionState;
}

const defaultExecutionState: ExecutionState = {
  status: "idle",
  result: null,
  startedAt: null,
  completedAt: null,
  lastInput: null,
};

export const usePipelineStore = create<PipelineStore>((set, get) => ({
  // Initial state
  pipelines: [],
  isLoading: false,
  error: null,
  executions: {},

  // Pipeline list actions
  setPipelines: (pipelines) => set({ pipelines, error: null }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),

  // Execution actions
  startExecution: (pipelineName, input) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [pipelineName]: {
          status: "running" as ExecutionStatus,
          result: null,
          startedAt: new Date(),
          completedAt: null,
          lastInput: input ?? state.executions[pipelineName]?.lastInput ?? null,
        },
      },
    })),

  completeExecution: (pipelineName, result) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [pipelineName]: {
          status: result.success ? ("success" as ExecutionStatus) : ("error" as ExecutionStatus),
          result,
          startedAt: state.executions[pipelineName]?.startedAt || null,
          completedAt: new Date(),
          lastInput: state.executions[pipelineName]?.lastInput ?? null,
        },
      },
    })),

  failExecution: (pipelineName, error) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [pipelineName]: {
          status: "error" as ExecutionStatus,
          result: {
            success: false,
            output: null,
            error,
            metadata: {},
          },
          startedAt: state.executions[pipelineName]?.startedAt || null,
          completedAt: new Date(),
          lastInput: state.executions[pipelineName]?.lastInput ?? null,
        },
      },
    })),

  resetExecution: (pipelineName) =>
    set((state) => ({
      executions: {
        ...state.executions,
        [pipelineName]: defaultExecutionState,
      },
    })),

  getExecutionState: (pipelineName) => {
    const state = get();
    return state.executions[pipelineName] || defaultExecutionState;
  },
}));
