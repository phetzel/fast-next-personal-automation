export const queryKeys = {
  dashboard: {
    all: ["dashboard"] as const,
    health: () => [...queryKeys.dashboard.all, "health"] as const,
  },
  email: {
    all: ["email"] as const,
    sources: () => [...queryKeys.email.all, "sources"] as const,
    config: () => [...queryKeys.email.all, "config"] as const,
    destinations: (params?: unknown) => [...queryKeys.email.all, "destinations", params] as const,
    syncs: (params?: unknown) => [...queryKeys.email.all, "syncs", params] as const,
    messages: (params?: unknown) => [...queryKeys.email.all, "messages", params] as const,
    triageMessages: (params?: unknown) =>
      [...queryKeys.email.all, "triage-messages", params] as const,
    triageStats: () => [...queryKeys.email.all, "triage-stats"] as const,
    subscriptions: (params?: unknown) => [...queryKeys.email.all, "subscriptions", params] as const,
    actionLogs: (params?: unknown) => [...queryKeys.email.all, "action-logs", params] as const,
    stats: () => [...queryKeys.email.all, "stats"] as const,
  },
  jobs: {
    all: ["jobs"] as const,
    list: (params?: unknown) => [...queryKeys.jobs.all, "list", params] as const,
    detail: (id: string) => [...queryKeys.jobs.all, "detail", id] as const,
    stats: () => [...queryKeys.jobs.all, "stats"] as const,
    profiles: () => [...queryKeys.jobs.all, "profiles"] as const,
    profile: (id: string) => [...queryKeys.jobs.profiles(), id] as const,
    resumes: () => [...queryKeys.jobs.all, "resumes"] as const,
    stories: () => [...queryKeys.jobs.all, "stories"] as const,
    projects: () => [...queryKeys.jobs.all, "projects"] as const,
  },
  finances: {
    all: ["finances"] as const,
    stats: () => [...queryKeys.finances.all, "stats"] as const,
    accounts: () => [...queryKeys.finances.all, "accounts"] as const,
    budgets: (params?: unknown) => [...queryKeys.finances.all, "budgets", params] as const,
    budgetStatus: (month: number, year: number) =>
      [...queryKeys.finances.all, "budget-status", month, year] as const,
    categories: (params?: unknown) => [...queryKeys.finances.all, "categories", params] as const,
    recurring: (params?: unknown) => [...queryKeys.finances.all, "recurring", params] as const,
    transactions: (params?: unknown) =>
      [...queryKeys.finances.all, "transactions", params] as const,
  },
  pipelines: {
    all: ["pipelines"] as const,
    list: (params?: unknown) => [...queryKeys.pipelines.all, "list", params] as const,
    executions: () => [...queryKeys.pipelines.all, "executions"] as const,
    runs: (params?: unknown) => [...queryKeys.pipelines.all, "runs", params] as const,
    run: (id: string) => [...queryKeys.pipelines.all, "run", id] as const,
    stats: (pipelineName?: string, sinceHours?: number) =>
      [...queryKeys.pipelines.all, "stats", pipelineName ?? null, sinceHours ?? null] as const,
  },
  schedules: {
    all: ["schedules"] as const,
    list: () => [...queryKeys.schedules.all, "list"] as const,
    occurrences: (params?: unknown) => [...queryKeys.schedules.all, "occurrences", params] as const,
  },
  openClaw: {
    all: ["openclaw"] as const,
    tokens: () => [...queryKeys.openClaw.all, "tokens"] as const,
  },
} as const;
