name: pa_jobs_ingest
description: Submit ranked jobs, optionally with application analysis, to the personal_automations OpenClaw ingest endpoint.
metadata: {"openclaw":{"requires":{"bins":["bash","curl"],"env":["PERSONAL_AUTOMATIONS_API_BASE_URL","PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"]},"primaryEnv":"PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN"}}
---

# Personal Automations Job Ingest

Use this skill when jobs have already been sourced and ranked by OpenClaw and need to be written into the user's jobs area in `personal_automations`.

## Preconditions

- `PERSONAL_AUTOMATIONS_API_BASE_URL` points to the FastAPI backend origin, not the Next.js frontend
- `PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN` is an active `oct_...` token with `jobs:ingest`
- Never print or echo the token

## Payload

Send `POST /api/v1/integrations/openclaw/jobs/ingest` with header `X-Integration-Token`.

Required per job:

- `title`
- `company`
- `job_url`

Useful optional job fields:

- `location`
- `description`
- `salary_range`
- `date_posted`
- `source`
- `is_remote`
- `job_type`
- `company_url`

If OpenClaw already visited the application page, also include the application-analysis fields so the job lands as `analyzed` immediately:

- `application_type`
- `application_url`
- `requires_cover_letter`
- `requires_resume`
- `detected_fields`
- `screening_questions`
- `analyzed_at`

This skill assumes OpenClaw is the system that analyzes and ranks jobs:

- Include `relevance_score` as a `0-10` number
- Include `reasoning` only when `relevance_score` is present
- Always set `analyze_with_profile=false`
- Set `save_all=false` when `min_score` should control what is stored

The backend can do profile-based fallback analysis and QA, but this skill does not use that path.

## Example Payload

```json
{
  "jobs": [
    {
      "title": "Senior Backend Engineer",
      "company": "Acme",
      "job_url": "https://acme.com/jobs/1",
      "location": "Remote",
      "source": "linkedin",
      "relevance_score": 8.8,
      "reasoning": "Strong FastAPI and backend-platform fit.",
      "application_type": "ats",
      "application_url": "https://acme.com/jobs/1/apply",
      "requires_cover_letter": true,
      "requires_resume": true,
      "screening_questions": [
        {"question": "Do you need visa sponsorship?", "type": "boolean"}
      ]
    }
  ],
  "analyze_with_profile": false,
  "save_all": false,
  "min_score": 7.5,
  "search_terms": "senior backend engineer remote"
}
```

## Run

```bash
"{baseDir}/submit_jobs.sh" /path/to/payload.json
```

If no file is passed, the script reads JSON from stdin.

## Report Back

Report:

- `jobs_received`
- `jobs_analyzed`
- `jobs_saved`
- `duplicates_skipped`
- `high_scoring`
- `external_analysis_used`
- `analysis_enabled`
- `qa_with_internal_analysis`
- `qa_jobs_checked`
- `qa_large_score_drift`

On `4xx`, inspect the response body and fix the payload, token, or config. Do not retry blindly.
