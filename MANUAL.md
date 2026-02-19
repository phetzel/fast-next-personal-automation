# Manual Testing Checklist: Calendar / Scheduled Tasks

## Prerequisites
- [ ] Backend is running (`make run` or `uv run uvicorn app.main:app --reload`)
- [ ] Frontend is running (`bun dev`)
- [ ] Database migrations are applied (`uv run alembic upgrade head`)
- [ ] You are logged in as an authenticated user
- [ ] Taskiq worker/scheduler is running (if testing actual execution)

## 1. Navigation & Page Load
- [ ] Click "Schedules" in the sidebar -- page loads without errors
- [ ] Calendar component renders in month view by default
- [ ] "Scheduled Tasks" card renders below the calendar (shows empty state initially)
- [ ] No console errors in browser dev tools

## 2. Create a Schedule
- [ ] Click "New Schedule" button
- [ ] Dialog opens with "Create Schedule" title
- [ ] Fill in name: "Daily Job Search"
- [ ] Select a pipeline from the dropdown (verify pipelines are populated)
- [ ] Enter cron expression: `0 9 * * *` (daily at 9am)
- [ ] Select timezone: Pacific Time
- [ ] Pick a color
- [ ] Toggle enabled on/off and back on
- [ ] Click "Create" -- toast shows "Schedule created"
- [ ] New task appears in the "Scheduled Tasks" list below the calendar
- [ ] Calendar updates to show occurrences (dots/events in the month view)
- [ ] Verify the task shows correct `next_run_at` in the list

## 3. Create with Validation Errors
- [ ] Open new schedule dialog, leave name empty, click Create -- error toast appears
- [ ] Try with no pipeline selected -- error toast appears
- [ ] Try with invalid cron expression (e.g., `invalid`) -- backend returns error
- [ ] Try with invalid timezone -- backend returns error

## 4. View Calendar Occurrences
- [ ] With at least one schedule, verify occurrences appear on the calendar
- [ ] Navigate to next month (right arrow) -- new occurrences load
- [ ] Navigate to previous month (left arrow) -- occurrences load
- [ ] Switch to Week view (W key or dropdown) -- occurrences display correctly
- [ ] Switch to Day view (D key) -- occurrences display correctly
- [ ] Switch to Agenda view (A key) -- occurrences display correctly
- [ ] Switch back to Month view (M key) -- verify all keyboard shortcuts work
- [ ] Click "Today" button -- navigates back to current date

## 5. Edit a Schedule
- [ ] Click the Edit (pencil) icon on a scheduled task in the list
- [ ] Dialog opens with "Edit Schedule" title and pre-filled values
- [ ] Change the name and cron expression
- [ ] Click "Update" -- toast shows "Schedule updated"
- [ ] Verify the list updates with new name and next run time
- [ ] Verify calendar occurrences update to reflect new schedule

## 6. Click a Calendar Event/Occurrence
- [ ] Click on an occurrence in the calendar
- [ ] Verify the event dialog opens showing event details
- [ ] Note: This opens the generic calendar EventDialog, not the schedule form -- verify behavior is reasonable

## 7. Toggle Enable/Disable
- [ ] Click the Pause button on an active schedule
- [ ] Toast shows "Schedule paused"
- [ ] Badge changes from "Active" to "Paused"
- [ ] `next_run_at` clears (no "Next:" time shown)
- [ ] Calendar occurrences for this task disappear (enabled_only=true by default)
- [ ] Click the Play button to re-enable
- [ ] Toast shows "Schedule enabled"
- [ ] Badge returns to "Active"
- [ ] `next_run_at` is recalculated from now
- [ ] Calendar occurrences reappear

## 8. Delete a Schedule
- [ ] Click the Delete (trash) icon on a scheduled task
- [ ] Confirmation dialog appears
- [ ] Click Cancel -- nothing happens
- [ ] Click Delete again, confirm -- toast shows "Schedule deleted"
- [ ] Task disappears from the list
- [ ] Calendar occurrences for that task are removed

## 9. Delete via Calendar Event
- [ ] Click an occurrence on the calendar, then delete from the event dialog
- [ ] Confirmation appears warning about deleting the whole schedule
- [ ] Confirm -- schedule and all occurrences are removed

## 10. API Direct Testing (Optional, via curl/httpie)
- [ ] `GET /api/v1/schedules` -- returns paginated list
- [ ] `POST /api/v1/schedules` -- creates a task, returns 201
- [ ] `GET /api/v1/schedules/{id}` -- returns single task
- [ ] `PUT /api/v1/schedules/{id}` -- updates task
- [ ] `DELETE /api/v1/schedules/{id}` -- returns 204
- [ ] `POST /api/v1/schedules/{id}/toggle` -- inverts enabled state
- [ ] `POST /api/v1/schedules/{id}/toggle?enabled=false` -- explicitly disables
- [ ] `GET /api/v1/schedules/occurrences?start_date=...&end_date=...` -- returns computed occurrences
- [ ] Verify ownership: accessing another user's schedule returns 404

## 11. Edge Cases
- [ ] Create two schedules with different colors -- both appear correctly on calendar
- [ ] Create a schedule with `* * * * *` (every minute) and view a wide date range -- verify it doesn't hang (1000 occurrence cap)
- [ ] Create a disabled schedule -- verify no `next_run_at` is set
- [ ] Update only the description (partial update) -- verify other fields aren't affected
- [ ] Set description to empty string -- verify it clears

## 12. Backend Tests
- [ ] Run `pytest backend/tests/test_scheduled_task_service.py -v` -- all pass
- [ ] Run `pytest backend/tests/api/test_schedules.py -v` -- all pass
- [ ] Run `pytest backend/tests/test_worker.py -v` -- all pass

## 13. Worker/Scheduler (if Taskiq is running)
- [ ] Start the scheduler: `taskiq scheduler app.worker.taskiq_app:scheduler`
- [ ] Verify logs show "Loading scheduled tasks from database"
- [ ] Verify log shows count of loaded schedules
- [ ] Create a new schedule via API -- verify it appears on next scheduler poll
- [ ] Wait for a schedule to fire -- verify the pipeline executes
- [ ] Check that `last_run_at` and `next_run_at` update after execution
