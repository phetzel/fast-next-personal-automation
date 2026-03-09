---
name: personal_automations_openclaw_jobs
description: Add jobs into the personal_automations app by calling the existing OpenClaw ingest endpoint with a scoped integration token.
metadata: {"openclaw":{"requires":{"bins":["curl"]}}}
---

# Personal Automations OpenClaw Job Ingest

Use this skill when the user wants Clawbot or OpenClaw to add one or more jobs into the
`personal_automations` app.

## Preconditions

- `PERSONAL_AUTOMATIONS_API_BASE_URL` must point at the FastAPI backend origin.
  - Example: `https://api.example.com`
  - Do not use the Next.js frontend proxy origin unless the deployment explicitly forwards
    `/api/v1/integrations/openclaw/jobs/ingest` to FastAPI.
- `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN` must contain a valid `oct_...` token created in the app.
- This skill is intentionally limited to job ingest only.

## Preferred workflow

1. Build a JSON payload file with a `jobs` array.
2. Include `title`, `company`, and `job_url` for every job.
3. Run the helper script from this skill directory:

```bash
"{baseDir}/submit_jobs.sh" /path/to/payload.json
```

4. Report the response summary back to the user:
   - `jobs_received`
   - `jobs_saved`
   - `duplicates_skipped`
   - `analysis_enabled`

## Minimal payload

```json
{
  "jobs": [
    {
      "title": "Backend Engineer",
      "company": "Example Co",
      "job_url": "https://jobs.example.com/backend-engineer",
      "location": "Remote",
      "source": "manual"
    }
  ]
}
```

## Notes

- Leave `analyze_with_profile` unset unless there is a reason to override the backend default.
- `save_all` defaults to `true` on the backend, which is appropriate for this narrow add-jobs flow.
- Never print the integration token back to the user unless they explicitly ask for it.
- If the backend returns a validation error, show the error body and fix the payload rather than retrying blindly.
