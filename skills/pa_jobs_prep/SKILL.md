---
name: pa_jobs_prep
description: Trigger the personal_automations analyzed-job prep batch from OpenClaw.
metadata: {"openclaw":{"requires":{"bins":["bash","curl"],"env":["PERSONAL_AUTOMATIONS_API_BASE_URL","PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"]},"primaryEnv":"PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"}}
---

# Personal Automations Job Prep

Use this skill when OpenClaw has finished collecting/analyzing jobs and wants the app to generate cover letters and screening answers for analyzed jobs.

## Preconditions

- `PERSONAL_AUTOMATIONS_API_BASE_URL` points to the FastAPI backend origin
- `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN` is an active `oct_...` token with `jobs:prep`
- Never print or echo the token

## Payload

Send `POST /api/v1/integrations/openclaw/jobs/prep-batch` with header `X-Integration-Token`.

Accepted fields:

- `job_ids` optional explicit list of job UUIDs
- `max_jobs` integer from `1` to `50`
- `tone` one of `professional`, `conversational`, `enthusiastic`

If `job_ids` is omitted, the pipeline selects analyzed jobs up to `max_jobs`.

## Example Payload

```json
{
  "job_ids": [
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222"
  ],
  "max_jobs": 20,
  "tone": "professional"
}
```

## Run

```bash
"{baseDir}/prep_jobs.sh" /path/to/payload.json
```

If no file is passed, the script reads JSON from stdin.

## Report Back

Report:

- `success`
- `error`
- `metadata`
- `output.total_processed`
- `output.successful`
- `output.failed`
- `output.skipped`

If the pipeline returns per-job results, summarize the failures instead of pasting the whole payload.

On `4xx`, inspect the response body and fix the token scope or payload. Do not retry blindly.
