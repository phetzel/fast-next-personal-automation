---
name: pa_jobs_apply
description: Mark a pre-applied personal_automations job as successfully applied from OpenClaw.
metadata: {"openclaw":{"requires":{"bins":["bash","curl"],"env":["PERSONAL_AUTOMATIONS_API_BASE_URL","PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"]},"primaryEnv":"PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"}}
---

# Personal Automations Job Apply Success

Use this skill after OpenClaw has successfully submitted an application and needs to update the app's job record.

## Preconditions

- `PERSONAL_AUTOMATIONS_API_BASE_URL` points to the FastAPI backend origin
- `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN` is an active `oct_...` token with `jobs:apply`
- The target job is in any pre-applied state (`new`, `analyzed`, `prepped`, `reviewed`) or already `applied`
- Never print or echo the token

## Payload

Send `POST /api/v1/integrations/openclaw/jobs/{job_id}/apply-success` with header `X-Integration-Token`.

Accepted fields:

- `applied_at`
- `application_method`
- `confirmation_code`
- `notes`

If `application_method` is omitted, the backend defaults it to `openclaw`.

## Example Payload

```json
{
  "applied_at": "2026-03-13T18:45:00Z",
  "application_method": "openclaw",
  "confirmation_code": "ABC-12345",
  "notes": "Submitted through Greenhouse without validation errors."
}
```

## Run

```bash
"{baseDir}/mark_applied.sh" <job-id> /path/to/payload.json
```

If no file is passed, the script reads JSON from stdin.

## Report Back

Report:

- `id`
- `status`
- `applied_at`
- `application_method`
- `confirmation_code`

On `4xx`, inspect the response body and fix the job state, token scope, or payload. Do not retry blindly.
