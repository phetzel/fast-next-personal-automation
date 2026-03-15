# OpenClaw Integration

OpenClaw now owns browser-only job work for this app: discovery, application-page inspection, and recording apply success. The app remains the system of record for job status, scoring, prep artifacts, review state, and applicant data.

## Current Workflow

1. Jobs enter the app through manual creation, email sync, or OpenClaw ingest.
2. Manual jobs and external ingest can optionally attach a `profile_id` for later prep context.
3. OpenClaw can ingest jobs as:
   - `new` when it only has listing data
   - `analyzed` when it also sends application-page requirements
4. OpenClaw can update existing jobs to `analyzed` after visiting the application page.
5. Users can also run Manual Analyze inside the app to mark a job ready for prep without OpenClaw.
6. OpenClaw can trigger the internal `job_prep_batch` pipeline for analyzed jobs.
7. After manual review, OpenClaw can record a successful application and move the job to `applied`.

Current lifecycle: `new -> analyzed -> prepped -> reviewed -> applied -> interviewing/rejected`

## Auth Header

All OpenClaw machine routes use:

```http
X-Integration-Token: oct_...
```

## Token Scopes

- `jobs:ingest`
- `jobs:analyze`
- `jobs:prep`
- `jobs:apply`

## Routes

```http
POST /api/v1/integrations/openclaw/jobs/ingest
POST /api/v1/integrations/openclaw/jobs/{job_id}/analyze
POST /api/v1/integrations/openclaw/jobs/prep-batch
POST /api/v1/integrations/openclaw/jobs/{job_id}/apply-success
```

## Token Setup

1. Go to `/settings/openclaw` and create a token with the scopes OpenClaw needs.
   - The current default is all four jobs scopes: `jobs:ingest`, `jobs:analyze`, `jobs:prep`, `jobs:apply`.
2. Copy the plaintext `oct_...` token immediately. It is only shown once.
3. Configure the OpenClaw droplet:

```bash
export PERSONAL_AUTOMATIONS_API_BASE_URL=https://api.example.com
export PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN=oct_...
```

## Ingest Payload

Minimal payload:

```json
{
  "jobs": [
    {
      "title": "Backend Engineer",
      "company": "Example Co",
      "job_url": "https://jobs.example.com/backend-engineer",
      "location": "Remote",
      "source": "linkedin"
    }
  ]
}
```

Optional per-job enrichment fields:

- listing enrichment: `description`, `salary_range`, `date_posted`, `is_remote`, `job_type`, `company_url`
- fit scoring: `relevance_score`, `reasoning`
- application analysis: `application_type`, `application_url`, `requires_cover_letter`, `requires_resume`, `detected_fields`, `screening_questions`, `analyzed_at`

Top-level options:

- `search_terms`
- `profile_id`

If application-analysis fields are present, the job is persisted as `analyzed`. Otherwise it stays `new`.

## Analyze Existing Job

Use `POST /api/v1/integrations/openclaw/jobs/{job_id}/analyze` when the app already has the job but OpenClaw later visits the application page.

The payload can update:

- `description`
- `application_type`
- `application_url`
- `requires_cover_letter`
- `requires_resume`
- `detected_fields`
- `screening_questions`
- `analyzed_at`

This advances `new -> analyzed` and is idempotent for already analyzed jobs.

## Trigger Prep

Use `POST /api/v1/integrations/openclaw/jobs/prep-batch` with `jobs:prep` to run the internal prep batch synchronously for analyzed jobs.

Accepted fields:

- `job_ids` optional explicit subset
- `max_jobs`
- `tone`

## Record Apply Success

Use `POST /api/v1/integrations/openclaw/jobs/{job_id}/apply-success` with `jobs:apply` after OpenClaw successfully submits an application for a reviewed job.

Accepted fields:

- `applied_at`
- `application_method`
- `confirmation_code`
- `notes`

## Verify

```bash
curl "${APP_API_BASE_URL}/api/v1/jobs?page=1&page_size=5" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```
