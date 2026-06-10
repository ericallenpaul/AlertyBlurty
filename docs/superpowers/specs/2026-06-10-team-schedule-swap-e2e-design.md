# Team Schedule, Swap Workflow, and E2E Usability Design

## Context

AlertyBlurty already has users, teams, team membership, team rotation order, and a team-level `RequireAdminApprovalForSwaps` setting. The backend also has schedule and shift models plus repository methods, but those are not exposed through API endpoints and there is no schedule UI.

The MVP needs a real team scheduling workflow that can be exercised end to end:

- Create a manager and a team of four people.
- Add those people to a rotating on-call schedule.
- Show the schedule in a calendar UI.
- Allow shifts to be swapped.
- Let the admin choose between "admin approval only" and "no admin approval".
- Validate the full workflow with Playwright E2E tests and a usability evaluation.

## Goals

- Add a calendar-first team schedule experience to the existing team details workflow.
- Use an existing React calendar component instead of building a calendar from scratch.
- Add schedule API endpoints for creating schedules, generating shifts, and reading shifts.
- Add a real swap request workflow with auditable request, approval, rejection, and immediate-apply behavior.
- Cover manager and team-member workflows with E2E tests.
- Produce an evaluation of how easy the team/schedule/swap flow is to use.

## Non-Goals

- Multi-team workforce optimization.
- Complex availability rules, holidays, PTO, or weighted rotations.
- Recurring exception management beyond direct shift swaps.
- SMS notifications for every schedule change in this MVP.
- Replacing existing user/team pages outside the areas needed for scheduling.

## Calendar Component

Use FullCalendar React for the MVP calendar UI. The app should add the packages needed for React rendering and common views:

- `@fullcalendar/react`
- `@fullcalendar/daygrid`
- `@fullcalendar/timegrid`
- `@fullcalendar/list`
- `@fullcalendar/interaction`

The team schedule should support:

- Month view for broad rotation visibility.
- Week/time-grid view for shift timing.
- List/upcoming view for quick scanning.
- Event click to open shift details.
- Color/status treatment for normal, swapped, and pending-swap shifts.

FullCalendar is preferred because it is a maintained React calendar library with native month, time-grid, list, event, and interaction support. Current package details were checked against the FullCalendar React docs and release page before choosing it.

## Backend Data Model

Reuse the existing schedule and shift models:

- `OnCallSchedule`
- `OnCallShift`

Add a new swap request entity rather than overloading `OnCallShift`:

- `ShiftSwapRequest`
  - `Id`
  - `ShiftId`
  - `RequestedByUserId`
  - `TargetUserId`
  - `Status`
  - `RequiresApprovalSnapshot`
  - `RequestedAtUtc`
  - `DecidedAtUtc`
  - `DecidedByUserId`
  - `RequesterNote`
  - `DecisionNote`

Allowed statuses:

- `Pending`
- `Approved`
- `Rejected`
- `Applied`

`Applied` is used when the team is configured for no admin approval and the swap takes effect immediately. Approved requests should update the related `OnCallShift` fields so the active schedule reflects the final assignee and audit fields.

## API Design

Add schedule endpoints:

- `GET /api/teams/{teamId}/schedules`
- `POST /api/teams/{teamId}/schedules`
- `GET /api/schedules/{scheduleId}/shifts`
- `POST /api/schedules/{scheduleId}/generate-shifts`

Add swap endpoints:

- `POST /api/shifts/{shiftId}/swap-requests`
- `GET /api/teams/{teamId}/swap-requests`
- `POST /api/swap-requests/{swapRequestId}/approve`
- `POST /api/swap-requests/{swapRequestId}/reject`

Request and response DTOs should be explicit and small:

- `CreateScheduleRequest`
- `GenerateShiftsRequest`
- `CreateSwapRequest`
- `DecideSwapRequest`
- `OnCallScheduleDto`
- `OnCallShiftDto`
- `ShiftSwapRequestDto`

Errors should return normal API validation responses for invalid team, user, schedule, shift, and swap IDs. Attempts to swap a shift with a non-member should be rejected.

## Shift Generation

The generation endpoint creates future `OnCallShift` rows for a requested date range or horizon.

Rules:

- Use the team members sorted by `RotationOrder`.
- Generate contiguous shifts from the schedule start time.
- Use `Frequency` and `DurationMinutes` from `OnCallSchedule`.
- Do not create duplicate shifts for the same schedule and start time.
- Do not overwrite past shifts.
- Regenerating future shifts should be deterministic for the same team membership order and schedule settings.

For the MVP, if a team member is removed from a team, future schedule generation should exclude them. Existing historical shifts remain intact.

## Swap Behavior

Team setting: `RequireAdminApprovalForSwaps`.

When false:

- A team member can request a swap for a shift assigned to them.
- The request validates the target user is on the same team.
- The swap applies immediately.
- The shift is updated with swapped/audit fields.
- A `ShiftSwapRequest` is stored with status `Applied`.

When true:

- A team member can request a swap for a shift assigned to them.
- The request validates the target user is on the same team.
- The request is stored with status `Pending`.
- The calendar marks the shift as pending.
- A manager/admin can approve or reject.
- Approval updates the shift and marks the request `Approved`.
- Rejection leaves the shift unchanged and marks the request `Rejected`.

Only one active pending request should be allowed per shift. Attempts to create a second pending request should return a validation error.

## Authorization

Use the existing app authentication and role patterns.

- Admins and super admins can create schedules, generate shifts, and approve or reject swap requests.
- Team managers should be allowed to manage schedules and swap approvals for their own teams if the current role model supports team-scoped management cleanly.
- Team members can request swaps only for shifts assigned to them.
- Non-members cannot request swaps for another team's shifts.

If the current app does not yet distinguish team manager permissions cleanly, implement the MVP with admin/super-admin management and keep the UI copy as "manager/admin" only where accurate.

## Frontend Design

Add scheduling into the team details experience rather than creating a disconnected page.

Team details should include a schedule area with:

- Calendar view.
- Schedule selector if the team has more than one schedule.
- Create schedule action.
- Generate shifts action.
- Pending swap requests panel for admins/managers.
- Team setting control for admin approval mode.

Calendar events:

- Title: assignee display name.
- Time: shift start and end.
- Status: normal, swapped, pending swap.
- Click opens a shift details modal.

Shift details modal:

- Assignee.
- Start and end time.
- Swap status.
- Request swap action when the current user owns the shift.
- Approval/rejection controls when the current user has approval rights and the shift has a pending request.

Create schedule modal:

- Name.
- Frequency.
- Start date/time.
- Duration.
- Active/inactive state.

Generate shifts control:

- Horizon/date range input.
- Preview summary before generating if straightforward.
- Clear success/error feedback after generation.

The UI should use the existing React and Bootstrap style conventions in the repo. Controls should be compact and task-focused; this is an operational admin interface, not a landing page.

## E2E Test Design

Add Playwright tests that exercise the real UI and API-backed flows.

Scenario 1: Schedule creation and rotation

- Create or seed a manager/admin user.
- Create four users.
- Create one team.
- Add all four users to the team.
- Set team rotation order.
- Create a daily on-call schedule.
- Generate at least eight shifts.
- Verify the calendar renders the rotating assignments in order.

Scenario 2: No-admin-approval swap

- Set the team swap setting to no admin approval.
- Sign in as the assigned user for a future shift.
- Request a swap with another team member.
- Verify the calendar updates the assignee immediately.
- Verify the request is recorded as applied.

Scenario 3: Admin-approval swap

- Set the team swap setting to admin approval only.
- Sign in as the assigned user for a future shift.
- Request a swap with another team member.
- Verify the calendar marks the shift as pending.
- Sign in as the manager/admin.
- Approve the request.
- Verify the calendar updates the assignee.
- Repeat with a second request and reject it.
- Verify the rejected shift remains unchanged.

The tests should favor stable selectors and deterministic seeded data. If the existing auth test helpers are limited, add small E2E helpers rather than duplicating setup logic across tests.

## Usability Evaluation

After implementation, run the E2E scenario manually or through Playwright with screenshots and produce a short evaluation artifact.

Evaluate:

- How many steps it takes to create the team and schedule.
- Whether the calendar makes rotation ownership clear.
- Whether "admin approval only" vs "no admin approval" is obvious.
- Whether a normal team member can find the swap action.
- Whether pending, approved, rejected, and immediate swaps are visually distinguishable.
- Any friction or confusing labels discovered during the walkthrough.

Write the findings to an artifact or documentation file that does not include secrets or private phone numbers.

## Verification

Implementation is complete only after:

- Backend unit or integration tests cover schedule generation and swap request rules.
- Playwright E2E tests cover the three MVP scenarios.
- Existing frontend tests/build still pass.
- Existing backend tests/build still pass.
- A usability evaluation artifact exists with screenshots or clear written observations.

## Open Decisions Resolved

- The calendar is part of the MVP.
- FullCalendar React is the selected calendar component.
- Swaps are a real auditable workflow, not just direct shift edits.
- The team-level approval mode controls whether swaps apply immediately or require admin approval.
