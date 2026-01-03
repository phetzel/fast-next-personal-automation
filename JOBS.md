# Jobs Feature Implementation Plan

This document outlines the phased implementation for the Jobs/Job Search feature area, including architecture decisions, refactoring needs, and enhancement roadmap.

---

## Current State Review

### What Exists

**Backend:**
- `UserProfile` model (1:1 with User) with resume_text, target_roles, target_locations, min_score_threshold
- `Job` model for storing scraped job listings with AI analysis
- `JobSearchPipeline` that scrapes, analyzes, and stores jobs
- Pipeline registry with `@register_pipeline` decorator
- Services/repositories for jobs and user profiles

**Frontend:**
- Jobs page at `/jobs` with list, filters, stats, and detail modal
- Profile form on user settings page (`/profile`)
- Sidebar with Jobs as a flat nav item mixed with general features

### Issues Identified

1. **Sidebar Structure:** Jobs is a "project area" not a general feature like Dashboard/Chat/Pipelines
2. **Single Profile Limitation:** `UserProfile` has `unique=True` on `user_id` - only one profile per user
3. **Resume Management:** Resume stored as text only, no file upload/management
4. **No Pipeline Tagging:** Cannot associate pipelines with areas (like "jobs")
5. **No Area-Specific Agents:** All pipelines available to all agents
6. **Profile Required Error:** Pipeline fails with error instead of prompting for profile selection
7. **Naming:** `UserProfile` should be `JobSearchProfile` since it's job-search specific

---

## Phase 1: Sidebar Restructuring

**Goal:** Separate general navigation from project areas with collapsible sections.

### Backend Changes
- None required

### Frontend Changes

1. **Update sidebar data structure:**
   - Add `type: "general" | "area"` to nav items
   - Add `children` array for area sub-routes
   - Add `collapsible: boolean` for areas

2. **Create new navigation schema:**
   ```
   General:
   - Dashboard
   - Chat  
   - Pipelines
   
   ─────────── (separator)
   
   Areas:
   ▼ Jobs (collapsible)
     - Overview (/jobs)
     - Listings (/jobs/list)
     - Profiles (/jobs/profiles) [combined profiles + resumes with tabs]
     - Pipelines (/jobs/pipelines) [runs job pipelines]
     - Assistant (/jobs/assistant) [area-specific chat]
   ```

3. **Update sidebar component:**
   - Add separator component
   - Add collapsible section with chevron icon
   - Add sub-navigation indent styling
   - Persist collapsed state in localStorage or store

4. **Update constants:**
   - Add sub-routes to `ROUTES` constant

### Files to Modify
- `frontend/src/components/layout/sidebar.tsx` - Main restructuring
- `frontend/src/lib/constants.ts` - Add new routes
- `frontend/src/stores/sidebar-store.ts` - Add collapsed area state

### Completion Criteria
- [ ] Sidebar shows separator between general and area sections
- [ ] Jobs section is collapsible with sub-navigation
- [ ] Active sub-route highlights both parent and child
- [ ] Collapsed state persists across sessions

---

## Phase 2: Route Restructuring

**Goal:** Reorganize jobs routes to support area-based navigation.

### Frontend Changes

1. **Create new route structure:**
   ```
   /jobs                    → Overview/dashboard for jobs area
   /jobs/list               → Current job listings (moved from /jobs)
   /jobs/profiles           → Combined profiles + resumes management (with tabs)
   /jobs/pipelines          → Job-specific pipelines (search, analysis, etc.)
   /jobs/assistant          → Area-specific AI chat assistant
   ```

2. **Create Jobs Overview page:**
   - Quick stats cards
   - Recent job matches
   - Active profiles summary
   - Quick action buttons

3. **Move current jobs page:**
   - Relocate current `/jobs/page.tsx` content to `/jobs/list/page.tsx`

4. **Create Jobs layout:**
   - Shared layout for `/jobs/*` routes with area-specific header/breadcrumbs

### Files to Create
- `frontend/src/app/(dashboard)/jobs/layout.tsx`
- `frontend/src/app/(dashboard)/jobs/page.tsx` (new overview)
- `frontend/src/app/(dashboard)/jobs/list/page.tsx` (moved from /jobs)
- `frontend/src/app/(dashboard)/jobs/profiles/page.tsx` (combined profiles + resumes with tabs)
- `frontend/src/app/(dashboard)/jobs/pipelines/page.tsx` (job-specific pipelines)
- `frontend/src/app/(dashboard)/jobs/assistant/page.tsx` (area-specific chat)

### Files to Modify
- `frontend/src/app/(dashboard)/jobs/page.tsx` - Replace with overview

### Completion Criteria
- [ ] Jobs overview page shows summary
- [ ] Job listings accessible at /jobs/list
- [ ] Profile management routes exist
- [ ] Breadcrumb navigation works

---

## Phase 3: Rename and Multi-Profile Support

**Goal:** Rename `UserProfile` to `JobSearchProfile` and support multiple profiles per user.

### Backend Changes

1. **Create migration:**
   - Rename table `user_profiles` → `job_search_profiles`
   - Drop `unique=True` constraint on `user_id`
   - Add `name` field (required, unique per user)
   - Add `is_default` boolean field

2. **Update model:**
   - Rename `UserProfile` to `JobSearchProfile`
   - Update relationships and indexes

3. **Update repository:**
   - Rename `user_profile_repo` → `job_search_profile_repo`
   - Add `get_by_user_and_name()`, `get_default()`, `set_default()` methods
   - Update `create()` to handle `name` and `is_default`

4. **Update service:**
   - Rename `UserProfileService` → `JobSearchProfileService`
   - Add `list_by_user()`, `get_or_create_default()` methods
   - Business logic for default profile handling

5. **Update API routes:**
   - Rename `/api/v1/profile` → `/api/v1/job-profiles`
   - Add list endpoint: `GET /api/v1/job-profiles`
   - Add get by ID: `GET /api/v1/job-profiles/{id}`
   - Add create: `POST /api/v1/job-profiles`
   - Add update: `PATCH /api/v1/job-profiles/{id}`
   - Add delete: `DELETE /api/v1/job-profiles/{id}`
   - Add set default: `POST /api/v1/job-profiles/{id}/set-default`

6. **Update schemas:**
   - Rename and add `name` field
   - Add `is_default` field

7. **Update pipeline:**
   - Accept `profile_id` in `JobSearchInput`
   - Fallback to default profile if not specified

### Frontend Changes

1. **Update types:**
   - Rename `UserProfile` → `JobSearchProfile`
   - Add `name` and `is_default` fields

2. **Create profile list component:**
   - Display all profiles for user
   - Show which is default
   - Add/edit/delete actions

3. **Update profile form:**
   - Add name field
   - Add is_default toggle
   - Support create and edit modes

4. **Update API client:**
   - Rename endpoints
   - Add list/CRUD operations

5. **Update hooks:**
   - Rename `useProfile` → `useJobSearchProfiles`
   - Add `createProfile`, `updateProfile`, `deleteProfile`, `setDefault` methods

### Database Migration
```sql
-- Rename table
ALTER TABLE user_profiles RENAME TO job_search_profiles;

-- Drop unique constraint
ALTER TABLE job_search_profiles DROP CONSTRAINT IF EXISTS user_profiles_user_id_key;

-- Add new columns
ALTER TABLE job_search_profiles 
  ADD COLUMN name VARCHAR(100) NOT NULL DEFAULT 'Default Profile',
  ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE;

-- Add unique constraint for name per user
ALTER TABLE job_search_profiles 
  ADD CONSTRAINT job_search_profiles_user_id_name_key UNIQUE (user_id, name);

-- Set existing profiles as default
UPDATE job_search_profiles SET is_default = TRUE;

-- Add index for default lookup
CREATE INDEX idx_job_search_profiles_user_default ON job_search_profiles(user_id, is_default) WHERE is_default = TRUE;
```

### Completion Criteria
- [ ] Model renamed to JobSearchProfile
- [ ] Multiple profiles per user supported
- [ ] Name field on profiles
- [ ] Default profile mechanism works
- [ ] All API endpoints functional
- [ ] Profile form on /profile page removed
- [ ] Profile management at /jobs/profiles

---

## Phase 4: File/Resume Management

**Goal:** Support resume file upload with reuse across profiles.

### Backend Changes

1. **Create Resume model:**
   ```python
   class Resume(Base, TimestampMixin):
       id: UUID
       user_id: UUID (FK)
       name: str  # User-friendly name
       original_filename: str
       file_path: str  # Storage path
       file_size: int
       mime_type: str
       text_content: str | None  # Extracted text for AI
       is_primary: bool  # User's main resume
   ```

2. **Create resume repository and service**

3. **Create resume API routes:**
   - `POST /api/v1/resumes/upload` - Upload resume file
   - `GET /api/v1/resumes` - List user's resumes
   - `GET /api/v1/resumes/{id}` - Get resume details
   - `DELETE /api/v1/resumes/{id}` - Delete resume
   - `POST /api/v1/resumes/{id}/extract-text` - Re-extract text
   - `POST /api/v1/resumes/{id}/set-primary` - Set as primary

4. **Update JobSearchProfile:**
   - Add `resume_id` FK (nullable, references Resume)
   - Remove `resume_text` field (replaced by Resume entity)
   - Profile uses linked resume's `text_content`

5. **Add file storage abstraction:**
   - Local storage for development
   - S3-compatible for production
   - Config via environment variables

6. **Add text extraction:**
   - PDF text extraction (pypdf or pdfplumber)
   - DOCX text extraction (python-docx)
   - Plain text passthrough

### Frontend Changes

1. **Create Resume types:**
   ```typescript
   interface Resume {
     id: string;
     name: string;
     original_filename: string;
     file_size: number;
     mime_type: string;
     is_primary: boolean;
     created_at: string;
   }
   ```

2. **Create Resume management component:**
   - File upload dropzone
   - List of uploaded resumes
   - Delete/rename actions
   - Set primary action

3. **Create Resume selector component:**
   - Dropdown for profile form
   - Shows resume name + filename
   - Option to paste text instead

4. **Update profile form:**
   - Add resume selector
   - Option to select file OR paste text
   - Show warning if neither set

5. **Add resume API routes to Next.js:**
   - Proxy upload to backend
   - Handle file streaming

### Storage Configuration
```python
# Local development
STORAGE_BACKEND = "local"
STORAGE_LOCAL_PATH = "./uploads"

# Production
STORAGE_BACKEND = "s3"
S3_BUCKET = "personal-automations-uploads"
S3_REGION = "us-east-1"
```

### Completion Criteria
- [ ] Resume upload works (PDF, DOCX, TXT)
- [ ] Text extraction works
- [ ] Resumes can be shared across profiles
- [ ] Profile can select resume or paste text
- [ ] Primary resume designation works

---

## Phase 5: Pipeline Tagging System

**Goal:** Enable tagging pipelines with areas for filtering and organization.

### Backend Changes

1. **Extend ActionPipeline base class:**
   ```python
   class ActionPipeline(ABC, Generic[InputT, OutputT]):
       name: str
       description: str
       tags: list[str] = []  # NEW: ["jobs", "automation", etc.]
       area: str | None = None  # NEW: Primary area association
   ```

2. **Update registry functions:**
   - Add `list_pipelines_by_tag(tag: str)` 
   - Add `list_pipelines_by_area(area: str)`
   - Include tags/area in `list_pipelines()` response

3. **Update JobSearchPipeline:**
   ```python
   class JobSearchPipeline(ActionPipeline[...]):
       name = "job_search"
       description = "..."
       tags = ["jobs", "scraping", "ai"]
       area = "jobs"
   ```

4. **Update API response schemas:**
   - Add `tags` and `area` to pipeline info response

### Frontend Changes

1. **Update pipeline types:**
   ```typescript
   interface Pipeline {
     name: string;
     description: string;
     tags: string[];
     area: string | null;
     input_schema: JSONSchema;
     output_schema: JSONSchema;
   }
   ```

2. **Add filtering to pipeline list:**
   - Filter by area dropdown
   - Filter by tags (multi-select)
   - URL params for filters

3. **Area-specific pipeline views:**
   - `/jobs/search` shows only jobs-area pipelines
   - Filter component for pipeline list page

### Completion Criteria
- [ ] Pipelines can be tagged
- [ ] Pipelines can have an area
- [ ] Registry functions filter by tag/area
- [ ] API returns tag/area info
- [ ] Frontend can filter pipeline list

---

## Phase 6: Area-Specific Agents

**Goal:** Create agents that only have access to area-specific pipelines and have custom system prompts.

### Backend Changes

1. **Create AreaAgent configuration:**
   ```python
   @dataclass
   class AreaAgentConfig:
       area: str  # e.g., "jobs"
       system_prompt: str
       allowed_pipeline_tags: list[str] | None = None
       allowed_pipelines: list[str] | None = None  # Explicit list
       additional_tools: list[Callable] | None = None
   ```

2. **Update AssistantAgent:**
   - Accept `area_config: AreaAgentConfig | None` parameter
   - Filter `list_available_pipelines` to only show area pipelines
   - Filter `run_pipeline` to only allow area pipelines
   - Use area-specific system prompt

3. **Create predefined area configs:**
   ```python
   JOBS_AGENT_CONFIG = AreaAgentConfig(
       area="jobs",
       system_prompt="""You are a job search assistant. You help users:
       - Search for jobs matching their profile
       - Review and organize job listings
       - Track application status
       - Analyze job fit
       Only use the job-related tools available to you.""",
       allowed_pipeline_tags=["jobs"],
   )
   ```

4. **Add area-specific agent factory:**
   ```python
   def get_jobs_agent() -> AssistantAgent:
       return AssistantAgent(area_config=JOBS_AGENT_CONFIG)
   ```

5. **Create area agent API endpoint:**
   - `POST /api/v1/agent/areas/{area}/chat` - Chat with area-specific agent
   - `GET /api/v1/agent/areas` - List available areas

6. **Update WebSocket handler:**
   - Accept `area` parameter
   - Use appropriate agent based on area

### Frontend Changes

1. **Add area to conversation types:**
   ```typescript
   interface Conversation {
     // ...existing fields
     area: string | null;  // null = general agent
   }
   ```

2. **Create area-aware chat:**
   - Jobs area chat at `/jobs/chat` or within jobs section
   - Show area badge in chat header
   - Different styling for area chats

3. **Add area selection when creating new conversation:**
   - Option to select area or use general agent
   - Default to general agent

4. **Update conversation list:**
   - Filter by area
   - Show area badge

### Completion Criteria
- [x] Area agent configs defined
- [x] Agent filters pipelines by area
- [x] Custom system prompts work
- [x] WebSocket supports area parameter
- [x] Frontend can create area-specific chats
- [x] Conversations have optional area

---

## Phase 7: Profile Selection in Pipeline Execution

**Goal:** Replace the "no profile" error with a profile selector when triggering job search.

### Backend Changes

1. **Update JobSearchInput:**
   ```python
   class JobSearchInput(BaseModel):
       profile_id: UUID | None = Field(
           default=None,
           description="Job search profile to use. If not provided, uses default profile."
       )
       # ...existing fields
   ```

2. **Update pipeline logic:**
   - If `profile_id` provided, use that profile
   - If not, get user's default profile
   - If no default, return structured error with available profiles

3. **Create structured error response:**
   ```python
   class ProfileRequiredError(BaseModel):
       error_type: str = "profile_required"
       message: str
       available_profiles: list[JobSearchProfileSummary]
       create_profile_url: str = "/jobs/profiles/new"
   ```

### Frontend Changes

1. **Extend DynamicForm for special field types:**
   - Add support for `x-profile-select` custom format
   - Render profile dropdown for such fields

2. **Create ProfileSelectField component:**
   - Fetch user's job search profiles
   - Show dropdown with profile names
   - Link to create new profile if none exist
   - Show profile summary on selection

3. **Update pipeline execution UI:**
   - For `job_search` pipeline, show profile selector prominently
   - If no profiles, show CTA to create one
   - Show selected profile details

4. **Handle profile_required error:**
   - Parse error response
   - Show profile selector in error state
   - Allow user to select and retry

### Integration Points
- Pipeline input schema has `profile_id` field
- Frontend recognizes and renders special selector
- Error handling guides user to profile creation

### Completion Criteria
- [x] `profile_id` field in JobSearchInput
- [x] Pipeline uses specified or default profile
- [x] Structured error when no profile available
- [x] Frontend shows profile selector
- [x] Error handling shows profile options
- [x] Quick link to create profile

---

## Migration Strategy

### Order of Implementation
1. Phase 1 (Sidebar) - Frontend only
2. Phase 2 (Routes) - Frontend restructuring
3. Phase 3 (Multi-Profile) - Full stack, includes migration
4. Phase 4 (Resume Files) - Full stack
5. Phase 5 (Pipeline Tags) - Backend + frontend
6. Phase 6 (Area Agents) - Full stack
7. Phase 7 (Profile Select) - Builds on Phase 3

### Approach
- **No backward compatibility concerns** - This is a personal project, clean breaks are preferred
- Delete old code rather than deprecate
- Migrations can be destructive if needed
- Prioritize clean architecture over migration complexity

---

## Testing Checklist

### Phase 1
- [ ] Sidebar renders correctly
- [ ] Collapse/expand works
- [ ] Mobile responsive

### Phase 2
- [ ] All routes accessible
- [ ] Navigation works
- [ ] Breadcrumbs correct

### Phase 3
- [ ] Create multiple profiles
- [ ] Set default profile
- [ ] Delete non-default profile
- [ ] Migration preserves data

### Phase 4
- [ ] Upload PDF resume
- [ ] Upload DOCX resume
- [ ] Text extraction works
- [ ] Resume selection in profile

### Phase 5
- [ ] Pipelines have tags
- [ ] Filtering works
- [ ] API returns tags

### Phase 6
- [x] Area agent has restricted tools
- [x] Custom system prompts work
- [x] WebSocket area routing works
- [x] CRUD toolsets for jobs and profiles

### Phase 7
- [ ] Profile selector in pipeline form
- [ ] Default profile used if not selected
- [ ] Error shows profile options

---

## Phase 8: Job Prep Pipeline

**Goal:** Generate tailored cover letters and prep notes for job applications.

### Backend Changes

1. **Add PREPPED status to JobStatus enum**
2. **Add new fields to Job model:**
   - `cover_letter` - AI-generated cover letter (text)
   - `cover_letter_file_path` - S3 path to generated PDF
   - `cover_letter_generated_at` - When PDF was generated
   - `prep_notes` - Combined resume highlights and talking points
   - `prepped_at` - When prep materials were generated
3. **Create job_prep pipeline** in `app/pipelines/actions/job_prep/`
   - Uses resume, primary story, and active projects
   - Generates tailored cover letter and prep notes
   - Updates job status to PREPPED
4. **Create cover letter PDF service** in `app/core/cover_letter_pdf.py`
   - Generates professional PDFs using ReportLab
   - Stores in S3 for later download/upload to job sites
5. **Add PDF endpoints:**
   - `POST /api/v1/jobs/{job_id}/cover-letter/generate-pdf` - Generate PDF after review
   - `GET /api/v1/jobs/{job_id}/cover-letter/download` - Download the PDF

### Frontend Changes

1. **Add JobSelectField component** for pipeline forms
2. **Add "Prep" button** to job table for jobs with status "new"
3. **Update StatusBadge** with prepped status styling
4. **Support URL params** to pre-fill pipeline forms

### Workflow
```
NEW → PREPPED → REVIEWED → (generate PDF) → APPLIED
         ↓           ↓
    AI generates  User edits    User calls
    cover letter  cover letter  generate-pdf endpoint
    (text)        (text)        → PDF stored in S3
```

### Completion Criteria
- [x] PREPPED status added to JobStatus enum
- [x] Job model has cover_letter, prep_notes, prepped_at fields
- [x] Job model has cover_letter_file_path, cover_letter_generated_at fields
- [x] job_prep pipeline generates materials from resume/story/projects
- [x] Cover letter PDF generation service created
- [x] PDF generation and download endpoints added
- [x] JobSelectField shows job dropdown in pipeline forms
- [x] Prep button on job table navigates to pipeline with job pre-selected
- [x] StatusBadge shows "Prepped" status

---

## Phase 9: Profile-Based Story and Project Linking

**Goal:** Link stories and projects to profiles for dynamic material selection per profile.

### Changes Made

1. **Backend - JobProfile Model Updates:**
   - Added `story_id` FK (nullable, references Story)
   - Added `project_ids` JSON field (array of project UUID strings)
   - Added `story` relationship for eager loading

2. **Backend - Project Model Updates:**
   - Removed `is_active` field (projects are now linked via profiles instead)

3. **Backend - Schema Updates:**
   - Added `story_id` and `project_ids` to JobProfileCreate/Update
   - Added `StoryInfo` and `ProjectInfo` embedded schemas for responses
   - Added `has_story`, `story_name`, `project_count` to JobProfileSummary
   - Removed `is_active` from Project schemas

4. **Backend - Service Updates:**
   - Added validation for story and project ownership in JobProfileService
   - Added `get_linked_projects()` method to fetch projects for a profile
   - Removed `toggle_active` and `get_active_for_user` from ProjectService

5. **Backend - API Updates:**
   - Profile endpoints now return story and project info
   - Removed `/projects/{id}/toggle-active` endpoint

6. **Frontend - Type Updates:**
   - Added story and project fields to JobProfile types
   - Removed `is_active` from Project types

7. **Frontend - ProfileForm Updates:**
   - Added story selector (dropdown)
   - Added project multi-select (checkboxes)
   - ProfileCard now shows linked story and projects

8. **Frontend - ProjectsTab Updates:**
   - Removed is_active toggle
   - Added info about linking projects to profiles

### Benefits
- Different profiles can have different story/project combinations
- More flexible material selection for different job types
- Cleaner project management (no more individual active toggles)

### Completion Criteria
- [x] story_id FK added to job_profiles
- [x] project_ids JSON array added to job_profiles
- [x] is_active removed from projects
- [x] Profile form includes story and project selectors
- [x] Profile card shows linked materials
- [x] API returns story and project info in profile responses

---

## Phase 10: Inline Pipeline Execution from Listings

**Goal:** Run pipelines directly from the job listings page without navigating away.

### Changes Made

1. **SearchJobsModal Component:**
   - New modal for running job_search pipeline inline
   - Shows profile selector and scraper type
   - Displays real-time progress and results
   - Shows top matching jobs with scores after completion
   - Refreshes job list automatically when done

2. **PrepJobModal Component:**
   - New modal for running job_prep pipeline inline
   - Shows job being prepped with profile and tone selectors
   - Displays progress during AI generation
   - Shows preview of cover letter and prep notes
   - Refreshes job list to reflect "prepped" status

3. **Enhanced JobDetailModal:**
   - Cover letter editing with inline save
   - Collapsible prep notes section
   - PDF download button when PDF exists
   - "Reviewed" transition generates PDF automatically
   - Shows "Prepare Materials" CTA for new jobs without prep

4. **JobTable Updates:**
   - Prep button now opens modal instead of navigating
   - Shows "Prepping..." indicator on row during pipeline execution
   - Visual feedback while prep is in progress

5. **New API Routes:**
   - `POST /api/jobs/[id]/cover-letter/generate-pdf` - Proxies to backend for PDF generation
   - `GET /api/jobs/[id]/cover-letter/download` - Proxies binary PDF download

6. **Job Type Updates:**
   - Added `cover_letter_file_path` and `cover_letter_generated_at` fields

### User Flow

1. **Search Jobs**: Click "Search Jobs" button in header → modal opens → configure → run → see results → list refreshes
2. **Prep Job**: Click "Prep" on any "new" job row → modal opens → configure → generate → see preview → close → job status = "prepped"
3. **Edit Cover Letter**: Click prepped job → edit cover letter → save changes
4. **Mark as Reviewed**: Click "Reviewed" status → cover letter saved → PDF generated → status = "reviewed"
5. **Download PDF**: Click "Download PDF" button → browser downloads cover letter PDF

### Completion Criteria
- [x] SearchJobsModal opens from listings header
- [x] PrepJobModal opens from "Prep" button on job rows
- [x] Prep progress shows inline on table row
- [x] Cover letter editable in job detail modal
- [x] Save cover letter changes works
- [x] Prepped → Reviewed generates PDF
- [x] PDF download works
- [x] Frontend API routes for PDF generation/download

---

## Phase 11: Soft Delete and Enhanced Scraping

**Goal:** Prevent re-scraping of deleted jobs and capture additional job metadata.

### Changes Made

1. **Soft Delete Implementation:**
   - Added `deleted_at` timestamp field to Job model
   - `delete()` now sets `deleted_at` instead of hard deleting
   - Deleted jobs excluded from listings but still checked for duplicates
   - Prevents re-scraping the same job after user deletes it

2. **Additional Scrape Fields from python-jobspy:**
   - `is_remote` (boolean) - Whether job is remote
   - `job_type` (string) - fulltime, parttime, internship, contract
   - `company_url` (string) - URL to company page

3. **Frontend Enhancements:**
   - Source column is now a clickable link (opens job posting)
   - Removed redundant external link button from actions
   - Location column shows "Remote" badge and job type badges

### Completion Criteria
- [x] Soft delete implemented for jobs
- [x] Deleted jobs prevent re-scraping
- [x] Additional scrape fields added
- [x] Frontend shows remote/job_type badges
- [x] Source is clickable link

---

## Phase 12: Email Sync Enhancements

**Goal:** Normalize email-sourced jobs with scraped jobs by fetching full descriptions and filtering by score.

### Changes Made

1. **Job Description Scraper (`backend/app/browser/job_scraper.py`):**
   - Playwright-based scraper for fetching full job descriptions from URLs
   - Domain-specific selectors for LinkedIn, Indeed, Glassdoor, Lever, Greenhouse, Dice, ZipRecruiter, HiringCafe
   - Fallback generic selectors for unknown sites
   - Batch scraping with concurrency control

2. **Email Sync Pipeline Enhancements:**
   - New `enrich_descriptions` input (default: true) - scrapes full descriptions from job URLs
   - New `save_all` input (default: false) - when false, only saves jobs meeting min_score threshold
   - New output fields: `jobs_enriched`, `jobs_filtered`
   - Uses profile's `min_score_threshold` for filtering

3. **Frontend Ingestion Source Display:**
   - Added `ingestion_source` to Job type (`"scrape" | "email" | "manual"`)
   - Job table shows ingestion source with icons:
     - 🔍 Blue for "Scraped" (job search pipeline)
     - 📧 Amber for "Email" (email sync)
     - ✏️ Purple for "Manual" (manually added)
   - Job card also shows ingestion source indicator
   - New filter dropdown to filter by ingestion source

### Benefits
- Email-sourced jobs now have full descriptions like scraped jobs
- Better AI analysis with complete job content
- Consistent data quality across all ingestion sources
- Clear visibility into how each job was discovered
- Option to filter out low-scoring email jobs

### Completion Criteria
- [x] Job description scraper created using Playwright
- [x] Email sync enriches descriptions before AI analysis
- [x] Email sync respects min_score threshold (save_all option)
- [x] Frontend shows ingestion source in job table and card
- [x] Frontend filter for ingestion source added

---

## Future Enhancements (Out of Scope)

1. **Job Application Tracking** - Track applied jobs, responses, interviews
2. ~~**Cover Letter Generation** - AI-generated cover letters per job~~ ✅ Implemented in Phase 8
3. ~~**Cover Letter PDF Export** - Professional PDF for job applications~~ ✅ Implemented in Phase 8
4. ~~**Interview Prep** - Company research, question preparation~~ ✅ Partially implemented (prep notes)
5. **Salary Research** - Market data integration
6. **Scheduled Searches** - Cron-based job searches with notifications
7. **Email Notifications** - New high-scoring job alerts
8. **Job Apply Pipeline** - Track application submission and method
9. **Auto-upload to Job Sites** - Automatically upload cover letter PDFs to Indeed/LinkedIn

---

## Status Tracking

| Phase | Status | Assignee | Notes |
|-------|--------|----------|-------|
| Phase 1 | ✅ Complete | - | Sidebar restructured with collapsible Jobs area |
| Phase 2 | ✅ Complete | - | Route restructuring with overview, list, placeholders |
| Phase 3 | ✅ Complete | - | Renamed to JobProfile, multi-profile support |
| Phase 4 | ✅ Complete | - | Resume file upload and management |
| Phase 5 | ✅ Complete | - | Pipeline tagging system (tags, area) |
| Phase 6 | ✅ Complete | - | Area-specific agents with filtered pipelines + CRUD toolsets |
| Phase 7 | ✅ Complete | - | Profile selection in pipeline execution |
| Phase 8 | ✅ Complete | - | Job prep pipeline with cover letter and prep notes |
| Phase 9 | ✅ Complete | - | Profile-based story and project linking |
| Phase 10 | ✅ Complete | - | Inline pipeline execution from listings page |
| Phase 11 | ✅ Complete | - | Soft delete and enhanced scraping fields |
| Phase 12 | ✅ Complete | - | Email sync enhancements (description scraping, score filtering, ingestion source display) |

---

*Last Updated: 2025-01-02*

