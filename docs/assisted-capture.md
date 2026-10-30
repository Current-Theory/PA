# Embedded management assistant

The former propose/copy/import workflow has been replaced. The assistant is the default home and can also open contextually over a workstream. Users speak/type normal requests; the model uses validated functions to read or change persistent application records and gives a concise confirmation.

See [the audit](assistant-evolution-audit.md), [current README](../README.md) and [validation](validation.md).

## Execution

1. Save the user message and a pending-turn checkpoint in the workspace.
2. Send the conversation/context to the server's `/api/assistant/chat` route. The server alone holds `WORK_HUB_AI_KEY`.
3. Responses function calling chooses whitelisted tools. The application validates their arguments, IDs, revisions and ambiguity state.
4. Execute each tool against the database, write a durable action receipt and checkpoint its result before continuing the model turn.
5. Send explicit function outputs back to the model. Preserve reasoning continuation items within the bounded turn.
6. Store the final confirmation separately from task/project records. Display actual action results alongside the prose.

Clear create/update/complete/note/schedule/project actions do not need proposal forms. Unknown records, multiple plausible matches and unknown material meeting dates are clarified. A UI selection can resolve an ambiguity, or the user can reply conversationally. Deletion moves to recoverable Trash; no permanent-delete tool exists.

## Recovery and data independence

The task/project database is the source of truth. Clearing a conversation leaves records untouched. If the model fails after an action succeeds, that confirmed action remains saved. Resume uses persisted call IDs and receipts, so an interrupted checkpoint does not create the task twice. Stop retains confirmed actions. Revisions and fresh reads protect against overwriting concurrent/manual changes.

Tasks, notes, completion outcomes, projects and history remain usable in the existing manual UI when AI is unavailable. IndexedDB is device-local; Settings provides a record backup. This is not cloud sync or a shared server database. A future storage/provider adapter can change persistence without making an AI conversation the only copy of work data.

## Connection and privacy

For local development, securely supply `WORK_HUB_AI_KEY` to `npm run ai:server` and run `npm run dev`. `.env.server.example` contains names only; its real counterpart is ignored. Never put a key in the browser, a URL or chat. The model setting defaults to `gpt-5-mini`, subject to project availability and API billing.

The hosted adapter uses the managed Azure Static Web Apps gateway, approved user role and configured origin. Hosted sign-in opens in another tab so the original assistant stays open. The portable file cannot contain a server key and therefore cannot provide connected AI. No ChatGPT tab/copy/import step is offered as a replacement.

The application sends the conversation, local calendar/workstream context, recent references and requested tool records to the API. It does not upload the entire database on every message. User record text is lower-trust data, not system instructions. No credentials or raw task/model responses are logged; `store: false` is set. API-provider processing/retention still follows the approved project/account terms.

Browser dictation is explicit and may use the browser vendor's online speech service. Permission/network errors retain text and allow typing/Windows dictation. Raw audio is not stored by this app.

## Scope

Tools manage this application's records. They do not send email, alter calendars, contact colleagues, assign Microsoft users or enable Graph providers. Tests use controlled model/speech/identity fixtures plus the real application database/action runtime; live model/device/Azure verification requires the corresponding securely configured service/device. Resource binding remains the final setup step, as requested.
