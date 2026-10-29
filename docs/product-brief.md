Build a production-quality web application/PWA tentatively called **EarnLearn Work Hub**.

This is initially a personal productivity application for an EarnLearn Programme Manager. Its purpose is to provide one simple interface for capturing, viewing, managing, completing and later retrieving work tasks that originate from meetings, Outlook email, Microsoft Planner and the user's own quick notes.

This must NOT become an isolated task-management database that competes with Microsoft 365.

The long-term source of truth should be Microsoft 365:
- Microsoft To Do for private/personal tasks and Outlook-connected tasks.
- Microsoft Planner for assigned/shared work and tasks arising from Teams/Planner.
- Microsoft Graph for integration.
- The application acts as a unified, significantly better front end over those services.

## Important implementation strategy

Build this in two stages within the same codebase.

### Stage 1 — fully working frontend

Build the complete interface using realistic mock task data and a clean data-provider abstraction.

The user must be able to run and evaluate the application without Microsoft Graph credentials.

Create interfaces/providers such as:

- TaskProvider
- MockTaskProvider
- MicrosoftTodoProvider
- MicrosoftPlannerProvider

The UI must never care which underlying provider supplied a task.

Use a normalized internal Task view-model while preserving source IDs so Microsoft tasks are updated rather than duplicated.

### Stage 2 — Microsoft 365 integration readiness

Prepare, but do not hard-code or fake, authentication/integration.

Use:
- Microsoft Entra ID
- MSAL
- Microsoft Graph v1.0 APIs wherever available
- delegated user authentication
- least-privilege permissions

Do NOT use Microsoft Graph Toolkit. It has been retired/deprecated and this project should use supported Microsoft Graph SDK/API approaches instead.

Do not rely on Microsoft Graph beta APIs for production-critical functionality.

If a feature such as Planner My Day is only exposed through beta, implement our own presentation behaviour rather than depending on an unsupported production API.

## Technology

Preferred stack:

- React
- TypeScript
- Vite
- modern responsive CSS
- PWA support
- React Router if routing is required
- MSAL React/browser for eventual Entra authentication
- Microsoft Graph JavaScript SDK or direct typed Graph service layer
- accessible semantic HTML
- good keyboard navigation

Keep dependencies sensible.

The application must work well in:
- Microsoft Edge
- Chrome
- 1920x1080 work monitors
- Surface/laptop screen
- narrow browser windows

The finished web app should later be capable of being hosted in Azure and embedded as a Microsoft Teams personal tab without rebuilding the UI.

Do not make the first version dependent on running inside Teams.

## Core UX principle

The user should never wonder:

"What am I supposed to be doing today?"

Opening the application should immediately answer that question.

## Main navigation

Create a compact left navigation containing:

1. Today
2. All Tasks
3. Upcoming
4. Waiting
5. Completed
6. Workstreams

Bottom of navigation:
- Search
- Settings
- connection/sync status

Use an EarnLearn branded sidebar rather than a generic Microsoft clone.

## TODAY page

This is the primary screen.

Header should show something like:

"Kia ora Ian"
"Thursday, 29 October"

Below it provide a prominent Quick Capture field:

"+ Add a task..."

The user should be able to type a task, press Enter and create it immediately.

Do not force a form before capture.

After capture, allow details to be added.

Today should contain clear sections:

### Focus Today
Tasks deliberately selected for today's work.

### Due Today
Tasks with today's due date.

### Overdue
Only show this section when overdue tasks exist.
Make overdue status obvious but not visually aggressive.

### Waiting / Follow-up
Items that require somebody else to respond or act.

### Upcoming
A small preview of the next several important tasks.

Avoid dashboard clutter and unnecessary charts.

This is an execution screen, not an analytics dashboard.

## Task cards

Each task row/card should show only the information necessary to act:

- completion checkbox
- task title
- due date where relevant
- priority
- workstream
- source icon/label
- waiting indicator where relevant

Possible source labels:

- Outlook
- Teams
- Planner
- To Do
- Manual

Do not overwhelm every card with metadata.

Clicking a task opens a right-side detail drawer without navigating away.

## Task detail drawer

Include:

### Task title

Editable inline.

### Status
- Not started
- In progress
- Waiting
- Completed

### Due date

### Priority
- Low
- Normal
- High
- Critical

### Workstream

Initial example workstreams:

- Programme Delivery
- Assessment & Content
- Regulatory & Quality
- LMS / Digital
- Providers & Stakeholders
- Projects
- Ideas / Improvements

Workstreams must be configurable.

### Source

Display where the task came from.

Example:

"Microsoft Teams — Electrical Delivery Meeting"

or

"Outlook — Re: Year 3 Re-enrolments"

Where a source URL is available provide:

"Open original"

Do not duplicate the source content unnecessarily.

### Notes

Provide a useful notes area.

The intention is that context remains available after the task is complete.

Example:

"Raised by Vittoria during delivery meeting.
Need to confirm whether wording matches current programme requirements.
Send final recommendation to Marketing."

### Checklist

Allow subtasks/checklist items.

Example:

- Review handbook
- Cross-check requirement
- Draft correction
- Send to Marketing

### Outcome / completion note

When completing an important task, allow an optional short completion/outcome note.

Example:

"Confirmed LC wording and sent corrections to Marketing 29/10."

This is particularly important because completed tasks should become a useful historical record rather than disappearing.

### Related resources

Allow task links such as:
- Outlook email
- Teams meeting
- SharePoint document
- webpage
- standard/reference

## Completing tasks

Checking a task should mark it completed in the underlying provider.

Animate completion subtly.

Remove it from active lists after a short delay.

Do NOT delete it.

Completed tasks must remain searchable.

## Completed page

This should be a genuine historical work log.

Allow:

- full-text search
- workstream filter
- completion-date filter
- source filter

Show:
- task title
- completed date
- workstream
- outcome/notes where available

Opening a completed task should show its retained context.

## Waiting

Waiting is a first-class workflow state.

Examples:

"Waiting on Prakash — Moodle access"

"Waiting on Marketing — handbook corrections"

Provide:
- person/organisation being waited on
- follow-up date
- original task
- notes

If follow-up date arrives, return the task to the user's attention on Today.

## Upcoming

Provide a clean chronological view:

Today
Tomorrow
This week
Next week
Later

Do not build a complex project Gantt chart.

## All Tasks

Include powerful but simple filtering:

- active/completed
- workstream
- source
- priority
- due date
- waiting
- text search

## Quick capture behaviour

Quick capture should be extremely fast.

Minimum required field:
- title

Optional natural shorthand can be supported later.

Example future behaviour:

"Review handbook Friday #content"

could create:
- title = Review handbook
- due Friday
- workstream Content

Do not prioritise natural-language parsing over the fundamental task system in the first build.

## Data model

Create a normalized view-model approximately supporting:

id
provider
providerTaskId
title
notes
status
priority
dueDate
createdAt
completedAt
workstream
sourceType
sourceName
sourceUrl
checklist
waitingFor
followUpDate
completionNote
isFocusToday

Do not assume every provider supports every field.

Create provider capability handling rather than corrupting or silently losing data.

Microsoft task IDs must remain canonical for Microsoft-backed records.

## Microsoft integration design

Microsoft To Do:

Use Graph To Do v1.0 for:
- task lists
- tasks
- notes/body
- due dates
- status
- checklist items
- linked resources
- completion

Microsoft Planner:

Use Graph Planner v1.0 for:
- tasks assigned to the signed-in user
- task details
- due dates
- progress
- descriptions
- checklists where supported
- plans/buckets
- creation/update/completion

Do not duplicate a Planner task into To Do merely to display it.

Aggregate the two providers into one UI.

Outlook flagged email tasks should ultimately appear through Microsoft's task ecosystem where possible.

Preserve links back to original Outlook/Teams/Planner items whenever Microsoft exposes them.

## Authentication

Prepare for Microsoft Entra SSO.

Desired eventual experience:

User opens Work Hub on their EarnLearn work computer.

If already authenticated to Microsoft 365, authentication should be as seamless as organisational policy permits.

No separate Work Hub password.

Do not put client secrets into browser code.

Use authorization code flow with PKCE/MSAL for the SPA.

All configuration values must come from environment configuration.

## Security

This is a work application.

Do not:
- log access tokens
- hard-code credentials
- store confidential task content unnecessarily in localStorage
- expose Graph responses in production logs
- add third-party analytics by default
- send task content to AI services
- invent external cloud services without justification

For the mock version use fictional/sample data only.

Structure the application so an organisation-approved Azure deployment is straightforward.

## PWA

Make the application installable as a PWA.

It should:
- have an application manifest
- have appropriate app icons/placeholders
- launch in a standalone window
- work well when pinned to Windows
- provide a clean loading state

Do not create misleading offline behaviour for Microsoft data.

If offline, clearly indicate that live Microsoft data cannot currently sync.

## Teams readiness

Architect the layout so that the exact same hosted application can later be displayed as a Microsoft Teams personal tab.

Do not create a separate Teams UI.

Do not require Teams APIs for normal browser use.

Teams-specific integration should be an optional host adapter later.

## EarnLearn visual design

Before finalising the visual system, inspect the supplied/current:

"EL 4204 - Electrical Apprentice Handbook (digital).pdf"

Use it as visual reference.

Translate the design language into a productivity application rather than copying handbook pages literally.

Important visual cues from the handbook:

- deep navy/dark teal primary field
- white EarnLearn branding
- teal/aqua secondary accents
- restrained lime green highlights
- light grey/white content surfaces
- angular geometric details
- small "+" motif used sparingly
- bold, confident typography
- generous whitespace
- clean technical/trades feeling

Do not guess that sampled colours are official corporate hex values.
Create CSS design tokens and document that the exact values should be validated against official EarnLearn brand assets later.

Use the lime colour for emphasis, not every button.

The interface should feel:

EarnLearn
+
professional operational dashboard
+
modern Microsoft productivity application

It should NOT feel like:
- a student LMS
- a Trello clone
- a consumer to-do app
- an electrical-themed novelty interface

Avoid gratuitous electrical imagery on the working screens.

Use brand geometry, colour and typography instead.

## Suggested desktop composition

Sidebar:
dark EarnLearn teal

Main workspace:
very light neutral background

Content:
white/light cards

Top header:
date, greeting, sync state, profile

Quick capture:
prominent but elegant

Task rows:
dense enough for professional productivity but with comfortable whitespace

Detail drawer:
approximately 380–460px on desktop

Use responsive behaviour for smaller screens.

## Accessibility

Include:
- WCAG-conscious contrast
- clear focus states
- keyboard operation
- appropriately labelled controls
- no colour-only status communication
- reduced-motion consideration

## Seed data

Populate the mock provider with realistic fictional Programme Manager tasks such as:

- Review Year 3 assessment wording
- Send apprentice handbook corrections to Marketing
- Confirm LMS migration milestone
- Follow up provider enrolment query
- Review EWRB regulatory update
- Prepare exam support pack requirements
- Waiting on ID team for Moodle update

Include:
- due today
- overdue
- future
- waiting
- completed
- Planner sourced
- Outlook sourced
- Teams sourced
- manually created examples

Do not use real apprentice or employee personal information.

## Deliverables

Build the actual working application, not merely wireframes.

Provide:

1. functioning React/TypeScript application
2. clear folder structure
3. mock data provider
4. Microsoft provider interfaces/stubs
5. responsive UI
6. PWA configuration
7. README explaining setup
8. README section explaining eventual Entra/Microsoft Graph configuration
9. `.env.example`
10. documented deployment path for Azure Static Web Apps or equivalent organisation-approved Azure hosting
11. documented route for later Teams personal-tab deployment

Run:
- lint
- typecheck
- production build

Fix errors before handing over.

## Priority order

If scope becomes large, prioritise in this order:

1. excellent Today experience
2. quick task capture
3. task details and notes
4. completion/history
5. waiting/follow-up workflow
6. search/filtering
7. provider architecture
8. Microsoft integration readiness
9. PWA
10. Teams-host readiness

Do not sacrifice the quality of the core daily workflow for unnecessary features.

At the end, give me:

- a concise explanation of the architecture
- what currently works
- what is mocked
- what is required from EarnLearn IT before Microsoft integration can go live
- exact Microsoft Graph permissions you believe are required and why
- any assumptions that need validation

Do not implement permissions broader than necessary simply because they are easier.
