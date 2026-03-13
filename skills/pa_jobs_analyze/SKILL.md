---
name: pa_jobs_analyze
description: Persist application-page analysis for an existing personal_automations job.
metadata: {"openclaw":{"requires":{"bins":["bash","curl"],"env":["PERSONAL_AUTOMATIONS_API_BASE_URL","PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"]},"primaryEnv":"PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"}}
---

# Personal Automations Job Analyze

Use this skill after OpenClaw has visited a job's application page and needs to persist requirements back into `personal_automations`.

## Preconditions

- `PERSONAL_AUTOMATIONS_API_BASE_URL` points to the FastAPI backend origin
- `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN` is an active `oct_...` token with `jobs:analyze`
- You already know the app's job UUID
- Never print or echo the token

## Payload

Send `POST /api/v1/integrations/openclaw/jobs/{job_id}/analyze` with header `X-Integration-Token`.

Include at least one real application-analysis field:

- `application_type`
- `application_url`
- `requires_cover_letter`
- `requires_resume`
- `detected_fields`
- `screening_questions`

Optional:

- `description`
- `analyzed_at`

This route advances `new -> analyzed` and can refresh analysis on jobs that are already analyzed or later in the workflow.

## Example Payload

```json
{
  "description": "Platform role focused on FastAPI, Postgres, and async systems.",
  "application_type": "ats",
  "application_url": "https://acme.com/jobs/1/apply",
  "requires_cover_letter": true,
  "requires_resume": true,
  "detected_fields": {
    "work_authorization": true,
    "linkedin_url": false
  },
  "screening_questions": [
    {"question": "Are you authorized to work in the US?", "type": "boolean"}
  ]
}
```

## Run

```bash
"{baseDir}/analyze_job.sh" <job-id> /path/to/payload.json
```

If no file is passed, the script reads JSON from stdin.

## Report Back

Report:

- `id`
- `status`
- `analyzed_at`
- `application_type`
- `application_url`
- `requires_cover_letter`
- `requires_resume`
- screening question count

On `4xx`, inspect the response body and fix the job id, token scope, or payload. Do not retry blindly.
