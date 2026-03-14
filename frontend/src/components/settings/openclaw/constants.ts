export type OpenClawScopeValue = "jobs:ingest" | "jobs:analyze" | "jobs:prep" | "jobs:apply";

export type OpenClawExampleValue = "ingest" | "analyze" | "prep" | "apply";

export interface OpenClawScopeOption {
  value: OpenClawScopeValue;
  label: string;
  description: string;
  route: string;
}

interface OpenClawExampleDefinition {
  value: OpenClawExampleValue;
  label: string;
  route: string;
  description: string;
  buildExample: (token: string) => string;
}

export interface OpenClawExampleOption {
  value: OpenClawExampleValue;
  label: string;
  route: string;
  description: string;
  example: string;
}

export const OPENCLAW_SCOPE_OPTIONS: OpenClawScopeOption[] = [
  {
    value: "jobs:ingest",
    label: "jobs:ingest",
    description: "Create new jobs from OpenClaw discovery.",
    route: "/api/v1/integrations/openclaw/jobs/ingest",
  },
  {
    value: "jobs:analyze",
    label: "jobs:analyze",
    description: "Mark jobs analyzed and persist application requirements.",
    route: "/api/v1/integrations/openclaw/jobs/:job_id/analyze",
  },
  {
    value: "jobs:prep",
    label: "jobs:prep",
    description: "Trigger analyzed-job prep batches inside this app.",
    route: "/api/v1/integrations/openclaw/jobs/prep-batch",
  },
  {
    value: "jobs:apply",
    label: "jobs:apply",
    description: "Mark reviewed jobs as successfully applied.",
    route: "/api/v1/integrations/openclaw/jobs/:job_id/apply-success",
  },
];

export const OPENCLAW_DEFAULT_SCOPES = OPENCLAW_SCOPE_OPTIONS.map((scope) => scope.value);

const OPENCLAW_EXAMPLE_DEFINITIONS: OpenClawExampleDefinition[] = [
  {
    value: "ingest",
    label: "Ingest jobs",
    route: "/api/v1/integrations/openclaw/jobs/ingest",
    description: "Create new jobs from OpenClaw discovery.",
    buildExample: (token) => `curl --fail-with-body --silent --show-error \\
  -X POST \"$APP_API_BASE_URL/api/v1/integrations/openclaw/jobs/ingest\" \\
  -H \"Content-Type: application/json\" \\
  -H \"X-Integration-Token: ${token}\" \\
  --data '{
    \"jobs\": [
      {
        \"title\": \"Backend Engineer\",
        \"company\": \"Example Co\",
        \"job_url\": \"https://jobs.example.com/backend-engineer\",
        \"location\": \"Remote\",
        \"source\": \"linkedin\"
      }
    ],
    \"search_terms\": \"backend engineer remote\"
  }'`,
  },
  {
    value: "analyze",
    label: "Analyze job",
    route: "/api/v1/integrations/openclaw/jobs/<job-id>/analyze",
    description: "Persist application requirements for an existing job.",
    buildExample: (token) => `curl --fail-with-body --silent --show-error \\
  -X POST \"$APP_API_BASE_URL/api/v1/integrations/openclaw/jobs/<job-id>/analyze\" \\
  -H \"Content-Type: application/json\" \\
  -H \"X-Integration-Token: ${token}\" \\
  --data '{
    \"application_type\": \"ats\",
    \"application_url\": \"https://boards.example.com/apply/123\",
    \"requires_cover_letter\": true,
    \"screening_questions\": [{\"label\": \"Why this company?\"}]
  }'`,
  },
  {
    value: "prep",
    label: "Prep batch",
    route: "/api/v1/integrations/openclaw/jobs/prep-batch",
    description: "Trigger the internal analyzed-job prep batch.",
    buildExample: (token) => `curl --fail-with-body --silent --show-error \\
  -X POST \"$APP_API_BASE_URL/api/v1/integrations/openclaw/jobs/prep-batch\" \\
  -H \"Content-Type: application/json\" \\
  -H \"X-Integration-Token: ${token}\" \\
  --data '{\"max_jobs\": 10, \"tone\": \"professional\"}'`,
  },
  {
    value: "apply",
    label: "Apply success",
    route: "/api/v1/integrations/openclaw/jobs/<job-id>/apply-success",
    description: "Mark a reviewed job as successfully applied.",
    buildExample: (token) => `curl --fail-with-body --silent --show-error \\
  -X POST \"$APP_API_BASE_URL/api/v1/integrations/openclaw/jobs/<job-id>/apply-success\" \\
  -H \"Content-Type: application/json\" \\
  -H \"X-Integration-Token: ${token}\" \\
  --data '{
    \"application_method\": \"openclaw\",
    \"confirmation_code\": \"ABC-123\",
    \"notes\": \"Application submitted successfully.\"
  }'`,
  },
];

export function getOpenClawExampleOptions(token: string): OpenClawExampleOption[] {
  return OPENCLAW_EXAMPLE_DEFINITIONS.map((definition) => ({
    value: definition.value,
    label: definition.label,
    route: definition.route,
    description: definition.description,
    example: definition.buildExample(token),
  }));
}

export function getOpenClawRoutesForScopes(scopes: string[]): string[] {
  return OPENCLAW_SCOPE_OPTIONS.flatMap((scope) =>
    scopes.includes(scope.value) ? [scope.route] : []
  );
}

export function formatOpenClawDate(value: string | null): string {
  if (!value) {
    return "Never";
  }

  return new Date(value).toLocaleString();
}
