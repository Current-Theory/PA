# Existing-system audit and implementation plan

Request received 30 October 2026. This is an evolution of the existing repository, not a replacement project. The supplied request ends after “If information is genuinely ambiguous and materially affects execution,”; material ambiguity is treated as a clarification requirement.

## Existing system, before changes

- React 19 / TypeScript / Vite; hash navigation in `App.tsx`, no routing dependency. EarnLearn responsive CSS, semantic task rows, focus-trapped details and capture panels.
- A normalized `Task` model preserves provider identity, title, notes, status, priority, due/completed timestamps, workstream, provenance, checklist, waiting/follow-up, resources, outcome and daily focus.
- `TaskHub` routes writes to providers and rejects unsupported fields. `MockTaskProvider` implements queued, durable IndexedDB writes and atomic assisted-capture batches. To Do / Planner remain fail-closed scaffolds.
- `DemoStorage` holds one workspace snapshot in `earnlearn-demo-v1` / `workspace` / `demo`. Data already survives reload independently of AI. It is device-local, not a server/shared database; there is no cloud task sync.
- Existing manual flows: quick create, detail edit, complete/reopen, waiting, due/upcoming/overdue views, searchable completion history, configurable workstreams. Missing: delete/trash, real project entities and persistent conversation/action receipts.
- Existing AI: OpenAI Responses structured-output proposals, then manual review/import. No function calling, conversational execution, task lookup/update tools or persistent assistant state. This cannot satisfy the new primary interaction.
- `useDictation` provides explicit browser speech recognition and fallback messaging. Actual device speech and live OpenAI access were not previously verified.
- A loopback Node adapter and a managed Azure Static Web Apps Functions package already protect the API key server-side, restrict origins and requests, and (hosted) enforce `work-hub-user`. MSAL/Graph authentication remains separate scaffolding.
- PWA shell caching and a portable HTML/ZIP build exist. GitHub CI runs lint/types/domain tests/build/browser checks. Azure has a deployment template, not a deployed resource. No live key, Azure identity or deployment target is present in the running environment.

## Decisions and plan

1. Preserve IndexedDB and existing task IDs/context. Evolve the snapshot with real projects, task revisions, recoverable deletion, action receipts and a separately persisted conversation. Make the application workspace the source of truth per the new brief; retain provider boundaries for future integrations. Do not claim a shared/cloud database exists.
2. Define structured, validated tools for the requested task/project actions. Restrict mutations to real records and fresh revisions, enforce ambiguity guards, preserve history, and make retried tool calls idempotent. AI receives no SQL/eval/arbitrary database access.
3. Use server-side Responses function calling, explicit tool results and bounded conversation loops. The model interprets language; controlled application functions execute actions against the workspace. The client never receives a key. Reuse the protected Node/Azure transports.
4. Make the embedded assistant the default home and a contextual drawer on task/workstream screens. Keep the useful manual views as secondary interfaces. Remove ChatGPT-tab/copy/import as a product workflow. Explain unavailable connections honestly rather than simulating AI.
5. Test migration, revisions, receipts, ambiguity, task/project actions, conversation follow-ups, API failure recovery and existing flows. Rebuild both hosted and portable artifacts. Live model/device/hosting validation remains dependent on real credentials, device access and deployment configuration.

The source-of-truth decision supersedes the initial brief’s Microsoft-first task-storage goal for this iteration. Existing Microsoft-backed identifiers must still be preserved if those providers are enabled later. Browser-local storage remains a documented limitation; multi-device or centrally managed storage needs a separate approved persistence adapter.
