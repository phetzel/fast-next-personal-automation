# Temp Email MVP Roadmap

## Goal

Build a safe Gmail-first email triage system inside this app that:

- syncs email on a schedule or manual trigger
- classifies messages into useful buckets
- routes job- and finance-related mail into existing app areas
- proposes cleanup and unsubscribe actions without making risky decisions silently
- creates a future path for OpenClaw / clawbot task execution

The first version should optimize for control, auditability, and low regret.

## Product Principles

- Gmail stays the source of truth.
- Thread-first where possible, message-level when necessary.
- Start read-only, then add `gmail.modify` actions behind an explicit permission upgrade.
- Prefer archive + label over delete.
- Never auto-click unsubscribe links in MVP.
- Every mailbox action must be logged and, where possible, reversible.
- High-confidence automation only. Everything else goes to review.

## Scope

### In Scope for MVP

- Gmail-only
- scheduled run plus manual "Run now"
- read-only triage
- bucket classification
- unsubscribe candidate queue
- routing to Jobs and Finances
- sender rules
- action audit log
- optional safe Gmail actions after `gmail.modify`

### Out of Scope for MVP

- sending replies
- permanent delete
- direct spam reporting
- auto-unsubscribe link clicking
- Outlook / IMAP / generic inbox support
- autonomous agent execution against the inbox

## Core User Flow

1. A user connects Gmail.
2. The app creates a default email sync schedule.
3. On schedule or manual trigger, the app fetches messages since the last successful run, with a small overlap buffer.
4. Messages are classified into one primary bucket plus flags.
5. High-confidence safe actions are suggested or applied based on policy.
6. Job emails are routed into Jobs.
7. Finance emails are routed into Finances.
8. Newsletter-like mail is queued into an unsubscribe / cleanup review area.
9. The user reviews low-confidence items, risky actions, and subscription candidates.
10. Every action is recorded in an audit trail.

## Data Model

Reuse existing tables:

- `email_sources`
- `email_messages`
- `email_destinations`
- `email_message_destinations`
- `email_syncs`
- `scheduled_tasks`
- `pipeline_runs`

### Changes to `email_messages`

Add:

- `bucket: string`
- `triage_status: string`
- `triage_confidence: float nullable`
- `actionability_score: float nullable`
- `summary: text nullable`
- `requires_review: bool`
- `unsubscribe_candidate: bool`
- `is_vip: bool`
- `triaged_at: timestamp nullable`
- `last_action_at: timestamp nullable`

Recommended enum values:

- `bucket`: `now`, `jobs`, `finance`, `newsletter`, `notifications`, `waiting`, `review`, `done`
- `triage_status`: `pending`, `classified`, `reviewed`, `actioned`, `ignored`

### New Table: `email_action_logs`

Purpose: audit and undo trail for all email actions.

Fields:

- `id: uuid`
- `user_id: uuid`
- `message_id: uuid nullable`
- `gmail_thread_id: string nullable`
- `action_type: string`
- `action_source: string`
- `action_status: string`
- `dry_run: bool`
- `reason: text nullable`
- `metadata: json`
- `created_at: timestamp`
- `applied_at: timestamp nullable`
- `undone_at: timestamp nullable`

Recommended enum values:

- `action_type`: `label`, `archive`, `mark_read`, `trash`, `route_jobs`, `route_finance`, `queue_unsubscribe`, `undo`
- `action_source`: `system`, `user`, `agent`
- `action_status`: `pending`, `applied`, `failed`, `undone`

### New Table: `email_sender_rules`

Purpose: user-defined sender policies and bucketing overrides.

Fields:

- `id: uuid`
- `user_id: uuid`
- `sender_pattern: string`
- `default_bucket: string nullable`
- `always_keep: bool`
- `auto_archive: bool`
- `queue_unsubscribe: bool`
- `route_destination: string nullable`
- `priority: int`
- `is_active: bool`
- `created_at: timestamp`
- `updated_at: timestamp`

Recommended `route_destination` values:

- `jobs`
- `finance`

## Pipelines

### New Pipelines

- `email_triage`
- `email_apply_actions`

### Existing Pipelines Reused

- `email_sync_jobs`
- `finance_email_sync`

### Pipeline Responsibilities

`email_triage`

- fetch inbox candidates
- classify bucket and flags
- generate summaries
- create unsubscribe candidates
- route jobs and finance emails internally
- create suggested mailbox actions

`email_apply_actions`

- apply safe Gmail mutations
- write `email_action_logs`
- support undo where possible

## API Endpoints

Keep current source and sync endpoints.

Add:

### Triage

- `POST /api/v1/email/triage/run`
- `GET /api/v1/email/triage/messages`
- `GET /api/v1/email/triage/messages/{message_id}`
- `POST /api/v1/email/triage/messages/{message_id}/review`

### Actions

- `POST /api/v1/email/actions`
- `GET /api/v1/email/actions/logs`
- `POST /api/v1/email/actions/{action_id}/undo`

### Unsubscribe Review

- `GET /api/v1/email/unsubscribe-candidates`
- `POST /api/v1/email/unsubscribe-candidates/{message_id}/approve`
- `POST /api/v1/email/unsubscribe-candidates/{message_id}/dismiss`

### Sender Rules

- `GET /api/v1/email/sender-rules`
- `POST /api/v1/email/sender-rules`
- `PATCH /api/v1/email/sender-rules/{rule_id}`
- `DELETE /api/v1/email/sender-rules/{rule_id}`

## Bucket Taxonomy

Each message gets one primary bucket plus zero or more flags.

### Primary Buckets

- `now`: needs human reply or decision soon
- `jobs`: recruiter mail, applications, interviews, offers, alerts
- `finance`: receipts, bills, statements, renewals
- `newsletter`: legit subscriptions and digests
- `notifications`: machine-generated alerts and product updates
- `waiting`: open loop, follow-up, or passive monitoring
- `review`: low-confidence or risky
- `done`: handled and safe to archive

### Flags

- `vip`
- `unsubscribe_candidate`
- `spam_suspect`
- `agent_candidate`
- `high_confidence`

## Filters and Query Strategy

Use a time-based fetch window plus a small overlap buffer instead of only "last X hours".

Default fetch strategy:

- since last successful triage run
- subtract 30-60 minutes overlap
- exclude trash, spam, sent, drafts

Recommended filters:

- inbox-only toggle
- unread-only toggle
- sender/domain allowlists
- sender/domain blocklists
- category filters
- has-unsubscribe-header flag
- has-attachment flag

## UI Screens

### 1. Settings / Email

- Gmail source management
- default schedule visibility
- sender rule management
- permission/scope status

### 2. Email / Triage

- primary work queue
- filters by bucket, date range, confidence, source
- bulk actions
- manual run button

### 3. Email / Review

- low-confidence items
- risky suggested actions
- explicit approve / reject decisions

### 4. Email / Subscriptions

- grouped by sender/domain
- unsubscribe review queue
- archive-all / rule creation shortcuts

### 5. Email / History

- action log
- sync / triage history
- undo surface

### Cross-Area UX

- Jobs pages should show linked email sources for recruiter and application messages.
- Finance pages should show linked receipt / bill emails.

## Safe Action Policy

### Default MVP Mode: Read-Only

Allowed automatically:

- classify bucket
- summarize thread
- queue unsubscribe candidates
- route to Jobs and Finances internally
- create suggested actions
- create sender-rule suggestions

No Gmail mutation occurs in this mode.

### Gmail Modify Mode

Allowed automatically for high-confidence, non-VIP messages:

- apply Gmail label
- archive
- mark read

Allowed only when backed by an explicit user rule:

- move to Trash

Always review-first:

- unsubscribe actions
- trash without explicit rule
- mixed or conflicting signals
- anything flagged `vip`

Never auto:

- permanent delete
- click unsubscribe links
- block sender
- report spam
- send replies

### Thresholds

- `< 0.80`: put in `review`
- `0.80 - 0.94`: suggest action only
- `>= 0.95`: allow safe auto-action if policy permits

### Guardrails

- every action must be logged
- archive / label / read / trash actions should support undo where possible
- dry-run mode should be the default during rollout
- VIP rules always win over automation

## Jobs and Finance Integration

### Jobs

- recruiter messages update existing jobs where possible
- job alert emails create or enrich job entries
- interview / rejection / offer messages attach to active job records

### Finances

- receipts route to finance extraction
- bills and renewals create finance review items
- subscription-like merchants can feed recurring expense suggestions later

## Agent Task Center (Post-MVP)

This should be a separate v2 queue, not direct inbox control.

Suggested future table: `agent_tasks`

Fields:

- `id`
- `user_id`
- `task_type`
- `message_id nullable`
- `status`
- `approval_required`
- `payload json`
- `result json`
- `created_at`
- `completed_at nullable`

Suggested task types:

- `visit_unsubscribe_page`
- `fetch_missing_invoice`
- `classify_unknown_sender`
- `summarize_long_thread`
- `prepare_recruiter_followup`

## MVP Delivery Phases

### Phase 0: Foundation

- finalize schema
- add migrations
- add triage pipeline skeleton
- add sender rule model
- add action log model

### Phase 1: Read-Only Triage

- run triage manually
- classify buckets
- generate summaries
- display triage queue
- add review queue

Exit criteria:

- user can run triage and see meaningful bucketed results
- no Gmail mutation required

### Phase 2: Cleanup Review

- add unsubscribe candidate queue
- add sender rules
- support archive recommendations
- add action history

Exit criteria:

- user can clear newsletters / low-value mail through review flow
- every action is auditable

### Phase 3: Jobs and Finance Routing

- fully connect triage outputs to Jobs and Finances
- show linked email context in those areas
- improve recruiter / receipt detection

Exit criteria:

- job- and finance-relevant email shows up in the correct area with traceability

### Phase 4: Gmail Modify Actions

- request `gmail.modify`
- apply labels, archive, mark read
- allow trash only for explicit safe rules
- add undo support

Exit criteria:

- system can safely reduce inbox volume without silent destructive behavior

### Phase 5: Agent Task Center

- create explicit task queue for OpenClaw / clawbot
- require approval for browser-like or risky actions
- keep inbox mutation behind policy and audit

## MVP Definition of Done

The MVP is done when:

- Gmail can be connected and scheduled
- the user can run triage manually or on schedule
- messages are bucketed into a useful queue
- jobs and finances route into existing app areas
- newsletter cleanup is reviewable
- all actions are logged
- risky actions are blocked or require approval

## Recommended First Build Order in Code

1. migration for schema additions
2. triage service + pipeline
3. triage list API
4. triage UI
5. unsubscribe review UI
6. action log API + UI
7. sender rules
8. Gmail modify action executor
9. agent task center v2
