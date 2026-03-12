# OpenClaw Integration

Clawbot pushes jobs into this app through a scoped token. All other job management stays in the app.

## Endpoint

```
POST /api/v1/integrations/openclaw/jobs/ingest
X-Integration-Token: oct_...
```

Scope required: `jobs:ingest`. Jobs are stored with `ingestion_source=openclaw`.

## Token Setup

1. Go to `/settings/openclaw` → create a token → copy the `oct_...` value immediately (shown once).
2. Set on the Clawbot side:
   ```bash
   export PERSONAL_AUTOMATIONS_API_BASE_URL=https://api.example.com
   export PERSONAL_AUTOMATIONS_OPENCLAW_TOKEN=oct_...
   ```

## Minimal Payload

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

Optional fields per job: `description`, `salary_range`, `date_posted`, `is_remote`, `job_type`, `company_url`, `relevance_score`, `reasoning`.

Top-level optional: `search_terms`, `analyze_with_profile` (bool), `profile_id`, `min_score`, `save_all`, `qa_with_internal_analysis`.

## Ingest Helper

The ingest helper is maintained on the OpenClaw droplet, not in this repository.
Run it from the droplet-side OpenClaw workspace with your payload file.

## Verify

```bash
curl "${APP_API_BASE_URL}/api/v1/jobs?page=1&page_size=5" -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

---

## Planned: Expand Clawbot Responsibilities

The current split is narrow: Clawbot ingests, the app does everything else. The planned direction is to give Clawbot more of the enrichment pipeline so the app receives pre-analyzed jobs.

**Target flow:**

1. Clawbot scrapes a job board or receives a URL/listing from Telegram
2. Clawbot runs browser analysis (Playwright on the Clawbot droplet): detects `requires_cover_letter`, `application_type`, `screening_questions`
3. Clawbot fetches resume text via a new read-scoped token and scores the job against it
4. Clawbot sends an enriched ingest payload — the app skips analysis and scoring steps entirely
5. For high-scoring jobs, Clawbot calls a new `POST /integrations/openclaw/jobs/{id}/prep` endpoint that runs `job_prep` and returns the cover letter + prep notes
6. Clawbot delivers results back to Telegram

**Consequences for the app:**
- `job_analyze` can be removed from the app entirely
- `job_search` becomes redundant once Clawbot handles all sourcing and can be removed
- Backend Playwright/browser-use dependencies stay out of the app server
- Two new integration additions needed: `jobs:read_resume` token scope + `/jobs/{id}/prep` endpoint

Resume and all prep materials stay in the app as the source of truth. Clawbot remains stateless.
