# Jobs Area Agent CRUD Toolsets - Testing Guide

This guide walks you through manually testing the new CRUD toolsets for the jobs area agent.

## Prerequisites

1. **Backend running**: `cd backend && uv run uvicorn app.main:app --reload --port 8000`
2. **Frontend running**: `cd frontend && bun dev`
3. **Database migrated**: `cd backend && uv run alembic upgrade head`
4. **User logged in**: Have a valid user session

---

## Test 1: Verify Agent Has Toolsets

### Steps
1. Open terminal in `backend/` directory
2. Run the verification script:

```bash
uv run python -c "
from app.pipelines.actions import discover_pipelines
discover_pipelines()

from app.agents.assistant import get_agent_for_area

agent = get_agent_for_area('jobs')
print('Agent area:', agent.area_config.area)
print('Has toolsets:', agent.area_config.toolsets is not None)
print('Pipeline tags:', agent.area_config.allowed_pipeline_tags)
"
```

### Expected Result
```
Agent area: jobs
Has toolsets: True
Pipeline tags: ['jobs']
```

---

## Test 2: Chat with Jobs Assistant - List Jobs

### Steps
1. Go to http://localhost:3000/jobs/assistant
2. Send message: **"Show me my jobs"** or **"List my saved jobs"**

### Expected Result
- Agent should call `jobs_list_jobs` tool
- Response should show a list of your saved jobs (or message saying no jobs found)
- Tool call card should appear in the chat showing the tool was invoked

---

## Test 3: Chat with Jobs Assistant - Job Stats

### Steps
1. In the jobs assistant chat
2. Send message: **"What are my job search statistics?"**

### Expected Result
- Agent should call `jobs_get_job_stats` tool
- Response should include:
  - Total jobs count
  - Breakdown by status (new, reviewed, applied, rejected, interviewing)
  - Average relevance score
  - High-scoring jobs count

---

## Test 4: Chat with Jobs Assistant - Update Job Status

### Prerequisites
- Have at least one saved job (run job_search pipeline first if needed)

### Steps
1. First, ask: **"Show me my new jobs"**
2. Note a job title or company name
3. Send: **"Mark the [company name] job as reviewed"** or **"Update the [job title] job to applied status"**

### Expected Result
- Agent should call `jobs_update_job_status` tool
- Response should confirm the status was updated
- Verify in /jobs/list that the job status changed

---

## Test 5: Chat with Jobs Assistant - List Profiles

### Steps
1. In the jobs assistant chat
2. Send message: **"List my job search profiles"**

### Expected Result
- Agent should call `profiles_list_profiles` tool
- Response should show your profiles with:
  - Profile names
  - Which one is default
  - Whether each has a resume linked
  - Target roles count

---

## Test 6: Chat with Jobs Assistant - Get Default Profile

### Steps
1. Send message: **"What's my default job profile?"**

### Expected Result
- Agent should call `profiles_get_default_profile` tool
- Response should show default profile details or message if none set

---

## Test 7: Chat with Jobs Assistant - Create Profile

### Steps
1. Send message: **"Create a new job profile called 'Remote Python Jobs' targeting Python Developer and Backend Engineer roles in Remote locations"**

### Expected Result
- Agent should call `profiles_create_profile` tool
- Response should confirm profile was created
- Verify in /jobs/profiles that the new profile appears

---

## Test 8: Chat with Jobs Assistant - Run Job Search Pipeline

### Prerequisites
- Have at least one profile with a resume linked

### Steps
1. Send message: **"Search for jobs matching my profile"**

### Expected Result
- Agent should call `run_pipeline` with `job_search` pipeline
- Response should show:
  - Number of jobs scraped
  - Number analyzed
  - Number saved
  - Top scoring jobs

---

## Test 9: Verify Pipeline Filtering

### Steps
1. In the jobs assistant chat
2. Send message: **"What pipelines can you run?"** or **"List available pipelines"**

### Expected Result
- Agent should call `list_available_pipelines` tool
- Response should ONLY show `job_search` pipeline (not `echo` or other non-jobs pipelines)

---

## Test 10: Verify Tool Prefixes in Tool Calls

### Steps
1. Open browser DevTools → Network tab
2. Filter by WS (WebSocket)
3. Interact with jobs assistant
4. Inspect WebSocket messages

### Expected Result
- Tool calls should show prefixed names like:
  - `jobs_list_jobs`
  - `jobs_get_job`
  - `profiles_list_profiles`
  - etc.

---

## Troubleshooting

### Agent not responding with tools
1. Check WebSocket connection in browser DevTools
2. Verify OPENAI_API_KEY is set in `.env`
3. Check backend logs for errors

### Tools returning "Database session not available"
1. Ensure you're authenticated (logged in)
2. Check that the WebSocket handler is passing `db` to `Deps`

### Profile tools not working
1. Verify user has profiles: check `/jobs/profiles` page
2. Try creating a profile first via web UI

### Jobs tools returning empty
1. Run the job_search pipeline first to populate jobs
2. Check `/jobs/list` to see if jobs exist

---

## Quick Verification Commands

```bash
# Verify imports work
cd backend && uv run python -c "from app.agents.tools.jobs import jobs_toolset, job_profiles_toolset; print('OK')"

# List all tools
cd backend && uv run python -c "
from app.agents.tools.jobs import jobs_toolset, job_profiles_toolset
print('Jobs tools:', list(jobs_toolset.tools.keys()))
print('Profile tools:', list(job_profiles_toolset.tools.keys()))
"

# Run tests
cd backend && uv run python -m pytest tests/test_agents.py -v
```

---

*Last Updated: 2025-12-24*


