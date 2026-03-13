# Jobs API Reference

This document is the current reference for the jobs area based on the code in:

- `backend/app/api/routes/v1/`
- `backend/app/pipelines/actions/`
- `backend/app/agents/`
- `frontend/src/app/api/`

It describes what exists today. It does not propose changes.

## Scope

The jobs area is not a single CRUD surface. It is a set of related entry points:

- Job records and cover-letter assets
- Job profiles used for search, scoring, and prep
- Jobs-tagged pipelines and pipeline run history
- Schedules that can trigger jobs pipelines
- Email-based job ingestion
- OpenClaw machine-to-machine job ingestion
- Jobs area agent endpoints and tools

Backend base path: `/api/v1`

Browser-facing frontend proxy base path: `/api`

## Authentication

Most jobs routes use standard user auth:

- Header: `Authorization: Bearer <access_token>`

The OpenClaw machine routes use scoped machine auth instead:

- Header: `X-Integration-Token: oct_...`
- Scopes: `jobs:ingest`, `jobs:analyze`, `jobs:prep`, `jobs:apply`

## Core Models

### Job

Jobs are stored in `jobs` with these notable fields:

- Identity: `id`, `user_id`, `profile_id`
- Listing data: `title`, `company`, `location`, `description`, `job_url`, `salary_range`, `date_posted`, `source`, `company_url`
- Discovery metadata: `ingestion_source` (`scrape`, `email`, `manual`, `openclaw`), `search_terms`, `is_remote`, `job_type`
- Matching data: `relevance_score`, `reasoning`
- Workflow data: `status`, `notes`
- Prep data: `cover_letter`, `cover_letter_file_path`, `cover_letter_generated_at`, `prep_notes`, `prepped_at`
- Application analysis: `application_type`, `application_url`, `requires_cover_letter`, `requires_resume`, `detected_fields`, `screening_questions`, `screening_answers`, `analyzed_at`
- Application submission: `applied_at`, `application_method`, `confirmation_code`

Statuses:

- `new`
- `analyzed`
- `prepped`
- `reviewed`
- `applied`
- `interviewing`
- `rejected`

Important implementation details:

- Jobs are soft-deleted with `deleted_at`.
- Duplicate detection is by `(user_id, job_url)`.
- Duplicate detection includes soft-deleted jobs, so deleting a job does not make it re-ingestable later.
- There is a public `POST /jobs` route for manually adding and scoring a job.
- Server-side transition rules are enforced in the job service, not just in the frontend.

### Job Profile

Profiles provide the context used by search, scoring, and prep:

- `name`
- `resume_id`
- `story_id`
- `project_ids`
- `target_roles`
- `target_locations`
- `min_score_threshold`
- `preferences`
- cover-letter contact fields:
  - `contact_full_name`
  - `contact_phone`
  - `contact_email`
  - `contact_location`
  - `contact_website`

## Backend Endpoints

### Jobs

#### `GET /api/v1/jobs`

Lists the current user's non-deleted jobs.

Query params:

- `status`: one of `new|analyzed|prepped|reviewed|applied|interviewing|rejected`
- `source`: free-form source string such as `linkedin`, `indeed`, `greenhouse`
- `ingestion_source`: `scrape|email|manual|openclaw`
- `min_score`: float `0-10`
- `max_score`: float `0-10`
- `search`: text matched against title, company, and description
- `posted_within_hours`: integer `>= 1`
- `page`: integer `>= 1`, default `1`
- `page_size`: integer `1-100`, default `20`
- `sort_by`: `created_at|relevance_score|date_posted|company`, default `created_at`
- `sort_order`: `asc|desc`, default `desc`

Response:

- `jobs`: array of full `JobResponse` records
- `total`
- `page`
- `page_size`
- `has_more`

#### `GET /api/v1/jobs/stats`

Returns aggregate job stats for the current user:

- `total`
- `new`
- `analyzed`
- `prepped`
- `reviewed`
- `applied`
- `interviewing`
- `rejected`
- `avg_score`
- `high_scoring`

`high_scoring` is currently defined as `relevance_score >= 7.0`.

#### `POST /api/v1/jobs/batch/delete`

Soft-deletes all jobs for one status.

Request body:

```json
{
  "status": "new"
}
```

Allowed statuses:

- `new`
- `analyzed`
- `prepped`
- `reviewed`

Response:

- `deleted_count`
- `status`

#### `GET /api/v1/jobs/{job_id}`

Returns one full job record for the current user.

#### `PATCH /api/v1/jobs/{job_id}`

Partial update for a job.

Supported writable fields:

- `status`
- `notes`
- `cover_letter`
- `prep_notes`

Notes:

- The backend enforces lifecycle transitions.
- Allowed forward transitions are:
  - `new -> analyzed`
  - `analyzed -> prepped`
  - `prepped -> reviewed`
  - `reviewed -> applied`
  - `applied -> interviewing|rejected`
  - `interviewing -> rejected`

#### `POST /api/v1/jobs`

Creates a manual job and scores it against the selected profile or the user's default profile.

Behavior:

- Requires a scorable profile with resume text
- Saves jobs with `ingestion_source="manual"`
- Saves manual jobs as `new`

#### `DELETE /api/v1/jobs/{job_id}`

Soft-deletes a single job.

#### `POST /api/v1/jobs/{job_id}/cover-letter/generate-pdf`

Generates or regenerates a PDF from the job's current `cover_letter` text.

Behavior:

- Requires the job to already have `cover_letter` text
- Uses the user's default job profile for contact info when available
- Stores the PDF through the configured storage backend
- Updates:
  - `cover_letter_file_path`
  - `cover_letter_generated_at`

#### `GET /api/v1/jobs/{job_id}/cover-letter/download`

Returns the generated PDF as `application/pdf` with attachment disposition.

#### `GET /api/v1/jobs/{job_id}/cover-letter/preview`

Returns the generated PDF as `application/pdf` with inline disposition.

### Job Profiles

#### `GET /api/v1/job-profiles`

Lists all profiles for the current user.

Response is an array of summaries, not full profiles.

#### `GET /api/v1/job-profiles/default`

Returns the current default profile, or `null`.

#### `GET /api/v1/job-profiles/{profile_id}`

Returns a full profile, including linked resume/story/project summaries.

#### `POST /api/v1/job-profiles`

Creates a profile.

Writable fields:

- `name`
- `is_default`
- `resume_id`
- `story_id`
- `project_ids`
- `target_roles`
- `target_locations`
- `min_score_threshold`
- `preferences`
- contact info fields

#### `PATCH /api/v1/job-profiles/{profile_id}`

Partial profile update.

#### `DELETE /api/v1/job-profiles/{profile_id}`

Deletes a profile. If it was the default, another profile may become default.

#### `POST /api/v1/job-profiles/{profile_id}/set-default`

Marks one profile as the user's default profile.

## Jobs Pipelines

Pipelines are listed and executed through the generic pipelines API.

### Discovery and Execution Endpoints

#### `GET /api/v1/pipelines`

Lists registered pipelines.

Useful filters:

- `area=jobs`
- `tags=jobs`
- `tags=jobs,ai`

Each pipeline includes:

- `name`
- `description`
- `input_schema`
- `output_schema`
- `tags`
- `area`

#### `GET /api/v1/pipelines/{pipeline_name}`

Returns the single pipeline definition and schemas.

#### `POST /api/v1/pipelines/{pipeline_name}/execute`

Executes a pipeline for the authenticated user.

Request shape:

```json
{
  "input": {
    "...": "..."
  }
}
```

Optional query param:

- `manual=true|false`

Response shape:

- `success`
- `output`
- `error`
- `metadata`

#### `POST /api/v1/pipelines/webhook/{pipeline_name}`

Executes a pipeline with webhook authentication.

Auth:

- `X-API-Key`

This route exists generically, but jobs pipelines that require `user_id` are not useful here unless the pipeline supports no-user execution.

### Pipeline Run History

#### `GET /api/v1/pipelines/runs`

Lists pipeline runs with filters:

- `pipeline_name`
- `status`
- `trigger_type`
- `started_after`
- `started_before`
- `success_only`
- `error_only`
- `my_runs_only`
- `page`
- `page_size`

#### `GET /api/v1/pipelines/runs/stats`

Run statistics for a pipeline or all pipelines.

#### `GET /api/v1/pipelines/runs/{run_id}`

Returns one run record.

#### `GET /api/v1/pipelines/{pipeline_name}/runs`

Run history scoped to a single pipeline.

### Currently Registered Jobs-Area Pipelines

These are discoverable today because `discover_pipelines()` imports them:

- `job_search`
- `job_search_batch`
- `job_prep`
- `job_prep_batch`
- `email_sync_jobs`

### `job_search`

Purpose:

- Scrape jobs from supported sources
- Score them against the selected profile resume
- Save matching jobs

Input:

- `profile_id` optional
- `scraper`: `jobspy|mock`, default `jobspy`
- `hours_old`, default `72`
- `results_per_term`, default `10`
- `save_all`, default `false`

Output:

- `total_scraped`
- `total_analyzed`
- `jobs_saved`
- `high_scoring`
- `duplicates_skipped`
- `top_jobs`

Persistence behavior:

- Saved jobs get `ingestion_source="scrape"`
- Saved jobs get `profile_id` for downstream prep

### `job_search_batch`

Purpose:

- Run `job_search` across all user profiles that have resumes

Input:

- `hours_old`
- `results_per_term`

Output:

- `total_profiles`
- `successful`
- `failed`
- `total_jobs_saved`
- `total_high_scoring`
- per-profile result list

### `job_prep`

Purpose:

- Generate cover letter and prep notes for one job

Input:

- `job_id`
- `profile_id` optional
- `tone`: `professional|conversational|enthusiastic`
- `generate_screening_answers`

Output:

- `job_id`
- `job_title`
- `company`
- `cover_letter`
- `prep_notes`
- `profile_used`
- `included_story`
- `included_projects`
- `skipped_cover_letter`
- `screening_answers`

Persistence behavior:

- Updates the job to `status="prepped"`
- Writes `prep_notes`
- Writes `cover_letter`
- Writes `prepped_at`
- Attempts PDF generation and storage automatically

Important implementation detail:

- The current implementation only generates a cover letter when application analysis requires one or the caller forces it.

### `job_prep_batch`

Purpose:

- Prep all `analyzed` jobs in descending score order

Input:

- `tone`
- `max_jobs`
- `max_concurrent`

Behavior:

- Uses each job's saved `profile_id` when available
- Falls back to the user's default profile

### `email_sync_jobs`

Purpose:

- Ingest jobs from Gmail job-alert emails

Input:

- `source_id` optional
- `force_full_sync`
- `save_all`

Output:

- `emails_processed`
- `jobs_extracted`
- `jobs_analyzed`
- `jobs_saved`
- `jobs_filtered`
- `high_scoring`
- `sources_synced`
- `errors`

Persistence behavior:

- Saved jobs get `ingestion_source="email"`
- Uses the user's default profile for scoring when resume text is available
- Fails the sync with a structured configuration error when no scorable profile is available

## Email Routes That Feed Jobs

These are not under `/jobs`, but they are part of the jobs intake surface.

### Email Sources

- `GET /api/v1/email/sources`
- `GET /api/v1/email/sources/{source_id}`
- `GET /api/v1/email/gmail/connect`
- `GET /api/v1/email/gmail/callback`
- `PATCH /api/v1/email/sources/{source_id}`
- `DELETE /api/v1/email/sources/{source_id}`

### Triggering Job Sync

- `POST /api/v1/email/sources/{source_id}/sync`
- `POST /api/v1/email/syncs`
- `GET /api/v1/email/syncs`
- `GET /api/v1/email/syncs/{sync_id}`
- `POST /api/v1/email/syncs/{sync_id}/cancel`
- `POST /api/v1/email/syncs/cancel-stale`

## Scheduling Jobs Pipelines

Schedules are generic, but jobs pipelines can be scheduled through them.

### Routes

- `GET /api/v1/schedules`
- `POST /api/v1/schedules`
- `GET /api/v1/schedules/{task_id}`
- `PUT /api/v1/schedules/{task_id}`
- `DELETE /api/v1/schedules/{task_id}`
- `POST /api/v1/schedules/{task_id}/toggle`
- `GET /api/v1/schedules/occurrences`
- `GET /api/v1/schedules/runs-calendar`
- `GET /api/v1/schedules/system-tasks`

### Schedule Payload Shape

Relevant fields:

- `name`
- `description`
- `pipeline_name`
- `cron_expression`
- `timezone`
- `enabled`
- `input_params`
- `color`

Execution path:

1. A schedule record is stored in PostgreSQL.
2. `DatabaseScheduleSource` reloads enabled tasks from the database.
3. Taskiq dispatches `app.worker.tasks.scheduled_pipeline:execute_scheduled_pipeline`.
4. That task calls the normal pipeline registry with `PipelineSource.CRON`.
5. The pipeline run is tracked in `pipeline_runs`.

## OpenClaw Integration

### Token Management

These routes use normal user JWT auth.

#### `POST /api/v1/integrations/openclaw/tokens`

Creates a token and returns the plaintext token once.

Request:

- `name`
- `scopes` default `["jobs:ingest", "jobs:analyze", "jobs:prep", "jobs:apply"]`
- `expires_at` optional

Response:

- `token`
- `token_info`

#### `GET /api/v1/integrations/openclaw/tokens`

Lists token metadata for the current user.

#### `DELETE /api/v1/integrations/openclaw/tokens/{token_id}`

Revokes one token.

### Machine Ingest Route

#### `POST /api/v1/integrations/openclaw/jobs/ingest`

Auth:

- `X-Integration-Token`
- required scope: `jobs:ingest`

Top-level request fields:

- `jobs` required, min length `1`
- `profile_id` optional
- `analyze_with_profile` default `true`
- `save_all` default `true`
- `min_score` optional
- `search_terms` optional
- `qa_with_internal_analysis` default `false`

Per-job fields:

- required: `title`, `company`, `job_url`
- optional listing data:
  - `location`
  - `description`
  - `salary_range`
  - `date_posted`
  - `source`
  - `is_remote`
  - `job_type`
  - `company_url`
- optional external scoring:
  - `relevance_score`
  - `reasoning`
- optional application analysis:
  - `application_type`
  - `application_url`
  - `requires_cover_letter`
  - `requires_resume`
  - `detected_fields`
  - `screening_questions`
  - `analyzed_at`

Validation rules:

- `reasoning` requires `relevance_score`
- `qa_with_internal_analysis=true` requires `analyze_with_profile=true`
- if `profile_id` is supplied, it must belong to the token's user
- QA analysis also requires resume text to be available through the selected/default profile

Response:

- `jobs_received`
- `jobs_analyzed`
- `jobs_saved`
- `duplicates_skipped`
- `high_scoring`
- `analysis_enabled`
- `external_analysis_used`
- `qa_with_internal_analysis`
- `qa_jobs_checked`
- `qa_large_score_drift`
- `profile_id`
- `profile_name`
- `token_id`
- `token_name`

Persistence behavior:

- Jobs are stored with `ingestion_source="openclaw"`
- External `relevance_score` and `reasoning` are stored directly when provided
- If external analysis is absent and profile resume context is available, internal analysis can score the jobs
- Jobs are saved directly as `analyzed` when application-analysis fields are present

Important note:

- OpenClaw should call the FastAPI backend origin directly. There is no frontend proxy route for machine ingest in `frontend/src/app/api/`.

### Machine Analyze Route

#### `POST /api/v1/integrations/openclaw/jobs/{job_id}/analyze`

Auth:

- `X-Integration-Token`
- required scope: `jobs:analyze`

Payload fields:

- `description`
- `application_type`
- `application_url`
- `requires_cover_letter`
- `requires_resume`
- `detected_fields`
- `screening_questions`
- `analyzed_at`

Behavior:

- Requires at least one application-analysis field
- Moves `new -> analyzed`
- Leaves later-stage jobs in place while refreshing analysis data

### Machine Prep Route

#### `POST /api/v1/integrations/openclaw/jobs/prep-batch`

Auth:

- `X-Integration-Token`
- required scope: `jobs:prep`

Payload fields:

- `job_ids` optional
- `max_jobs`
- `tone`

Behavior:

- Executes the internal `job_prep_batch` pipeline synchronously
- Targets analyzed jobs

### Machine Apply Route

#### `POST /api/v1/integrations/openclaw/jobs/{job_id}/apply-success`

Auth:

- `X-Integration-Token`
- required scope: `jobs:apply`

Payload fields:

- `applied_at`
- `application_method`
- `confirmation_code`
- `notes`

Behavior:

- Only valid for reviewed jobs unless the job is already applied
- Writes the application tracking fields and advances `reviewed -> applied`

## Jobs Area Agent Surface

### Routes

- `GET /api/v1/areas`
- `POST /api/v1/areas/jobs/chat`
- `GET /api/v1/ws/agent?area=jobs`

### Jobs Area Agent Capabilities

The jobs area agent is configured with:

- jobs CRUD-style toolset
- job profile toolset
- access to pipelines tagged with `jobs`

Tool names exposed to the agent:

- `jobs_list_jobs`
- `jobs_get_job`
- `jobs_update_job_status`
- `jobs_get_job_stats`
- `jobs_delete_job`
- `profiles_list_profiles`
- `profiles_get_profile`
- `profiles_get_default_profile`
- `profiles_create_profile`

The jobs area agent does not expose full profile update/delete tooling; those remain web-interface operations.

## Frontend Proxy Map

These browser-facing Next.js routes exist today and mostly forward to the backend:

### Jobs

- `GET /api/jobs`
- `GET /api/jobs/stats`
- `GET /api/jobs/{id}`
- `PATCH /api/jobs/{id}`
- `DELETE /api/jobs/{id}`
- `POST /api/jobs/{id}/cover-letter/generate-pdf`
- `GET /api/jobs/{id}/cover-letter/download`
- `GET /api/jobs/{id}/cover-letter/preview`

### Job Profiles

- `GET /api/job-profiles`
- `POST /api/job-profiles`
- `GET /api/job-profiles/default`
- `GET /api/job-profiles/{id}`
- `PATCH /api/job-profiles/{id}`
- `DELETE /api/job-profiles/{id}`
- `POST /api/job-profiles/{id}/set-default`

### Pipelines

- `GET /api/pipelines`
- `POST /api/pipelines/{name}/execute`
- additional pipeline run proxy routes under `/api/pipelines/runs`

### Schedules

- proxy routes exist under `/api/schedules`

### OpenClaw token management

- `GET /api/integrations/openclaw/tokens`
- `POST /api/integrations/openclaw/tokens`
- `DELETE /api/integrations/openclaw/tokens/{token_id}`

Implementation notes:

- The frontend hook `useJobs.deleteByStatus()` calls `/api/jobs/batch/delete`, but the checked-in App Router proxy file is `frontend/src/app/api/jobs/batch/dismiss/route.ts`.
- That proxy file forwards to `/api/v1/jobs/batch/dismiss`, while the backend route is `/api/v1/jobs/batch/delete`.
- The documented backend route in this file is the actual current backend route.

## Summary

Today, jobs can enter the system through four paths:

- `job_search` pipeline
- `email_sync_jobs` pipeline
- internal/manual service ingestion paths
- `POST /api/v1/integrations/openclaw/jobs/ingest`

Today, the supported external control surfaces around jobs are:

- jobs CRUD routes
- job profile routes
- generic pipeline discovery and execution
- generic scheduling
- email sync routes
- OpenClaw token and ingest routes
- jobs area agent REST/WebSocket routes
