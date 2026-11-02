# Final Work Hub refinement — local review

No changes have been committed, pushed or deployed in this pass.

## Changes

- **Today:** default home remains. Sections are now Today's focus, Overdue, Due today, Waiting / follow-up, in that order. A shared selector places every task in at most one section, including the existing Today conversation tool. Focus takes precedence regardless of due date. Future follow-ups stay in Waiting unless pinned; due, overdue and undated follow-ups surface on Today. The sidebar count is the total unique tasks actually surfaced. The extra Upcoming section was removed from Today; the Upcoming destination is retained. No focus quota or new status was introduced, and the existing capture/pin behaviour is preserved.
- **Daily Note:** the desktop notebook is sticky when width and height permit, with a bounded panel so its controls remain reachable. Narrow screens still stack. Permanent device-storage text is removed from the notebook; it shows Saving, briefly Saved, or a persistent failure/retry. History, dates, unsaved-draft recovery, search and backups remain.
- **Capture:** removed Conversation from the Add task form. The arrow exists only for nonblank input. The workstream selector is labelled Add to and belongs to capture; changing it no longer changes filters. Contextual workstream/project Conversation actions remain separate and show the real workstream in their panel heading.
- **Conversation:** one-row composer grows to a bounded height and follows viewport resizing. The conversation log scrolls above the anchored composer. Enter, Shift+Enter, IME, explicit microphone use, Send while recording, delayed final words, exactly-once submission, error recovery and timeout safeguards remain. Response instructions now call for direct actions/answers, short confirmations, no capability tutorials/filler, and “Working.” for a simple system test. No live model call was made to evaluate wording.
- **Orientation and lists:** only Today has the current-date heading and greeting. The redundant My workspace breadcrumb level is removed. All Tasks is labelled Tasks. Filters retain all capabilities in a lighter toolbar. Completed keeps search/date/source filters, removes redundant History heading and quick task creation, and has no growing sidebar badge. Only Today and Waiting retain operational counts. Projects and Workstreams have a small visual separator without new navigation labels.
- **Rows and Waiting:** common row layout keeps priority, date/follow-up, focus and navigation in order. Non-control row areas open details; buttons remain independent and keyboard reachable. Secondary actions reveal on hover/focus on pointer devices and remain available on touch. Pins have explicit Today's focus tooltips/accessibility labels. Waiting groups by trimmed, case-insensitive waiting-for text; follow-up dates are aligned in the common row and include textual today/overdue indicators. Group names are not repeated on each row; details and notes remain accessible.
- **Projects:** direct New project/Create project form uses existing name, workstream, notes and target-date fields. Workstream is required. The queued local provider validates dates, names, duplicates and existing workstreams, persists the existing Project structure and records a normal workspace event. Lists show workstream, status, target date, notes and outstanding/completed task counts. Conversation remains an alternative. Failed saves/duplicates retain input.

## Architecture and scope flags

There is **no meaningful data-model, hosted API contract, authentication or infrastructure change requiring separate approval**. No schema field, IndexedDB store, migration, package, status type, endpoint or resource was added. The existing Project schema, workspace write queue, event record structure and backup format are reused. Direct creation adds a local provider method, not an HTTP API.

The existing Today conversation tool now uses the same non-overlapping selection as the UI; its response keys and tool schema are unchanged. The only server edit is the conversation instruction text. Hosted API handlers, request/response contracts, key/model selection, security/error handling, Azure configuration, Microsoft authentication, roles, secrets and deployment workflows remain unchanged.

The portable download was rebuilt from the same updated application. No unrelated capabilities or organisational layers were added.

## Verification

- Lint and TypeScript passed.
- 56 unit tests across 11 files passed, including Today overlap/future-focus/count behaviour, direct project validation/persistence/rollback and outbound conversation instructions.
- 40 browser checks passed; the original portable file-navigation check was skipped because this managed browser blocks file URLs. The exact ZIP's HTML passed offline/subresource-free testing over loopback. The test remains enabled in unrestricted environments.
- Production frontend, managed API and portable builds passed; git whitespace checks passed.
- All-page axe accessibility and 390px overflow checks passed. The direct project form was additionally checked with axe and at 390px. Existing task editing, completion, history, filtering, recovery, backup, reload, hosted access, CSP, connection and dictation checks remain. Existing tests were updated for intentional labels/presentation rather than removing assertions.
- A new end-to-end test covers direct project creation, capture, organisation, future-due focus/unpinning, Waiting/follow-up, completion, searching after reload and backup of the same records. Additional checks cover independent capture/filter controls, duplicate-project input retention, transient note feedback, composer growth/anchoring and IME.
- Speech tests use a simulated browser recognition service. Physical Windows microphone/service behaviour and actual model response tone still need a live smoke test after a separately approved deployment.

## Screenshots

- [Today — desktop](screenshots/final-today-desktop.png)
- [Today — 390px](screenshots/final-today-mobile.png)
- [Conversation — desktop](screenshots/final-conversation-desktop.png)
- [Conversation — 390px](screenshots/final-conversation-mobile.png)
- [Projects — desktop](screenshots/final-projects-desktop.png)
