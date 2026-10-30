# Local setup and user acceptance

Azure deployment is deliberately out of scope. Use the **full repository**, not the portable HTML/ZIP, for connected local AI.

## Exact startup

Use Node **24.19 or a later Node 24 release**, with npm. From your `PA` repository folder:

```sh
npm ci
```

Create `.env.server` in that same folder, beside `package.json`, by copying `.env.server.example`. On PowerShell, use `Copy-Item .env.server.example .env.server` only if the destination does not exist; on macOS/Linux use `cp -n .env.server.example .env.server` and `chmod 600 .env.server`. Do not overwrite an existing local config.

Open `.env.server` in your local editor and fill the key there:

```dotenv
WORK_HUB_AI_KEY=YOUR_LOCAL_OPENAI_PROJECT_KEY
WORK_HUB_AI_MODEL=gpt-5-mini
WORK_HUB_AI_PORT=8787
WORK_HUB_APP_ORIGIN=
```

The key above is a placeholder to replace **on your machine**, never in chat. Use an authorised OpenAI project key with Responses API/model access and API billing/quota. A ChatGPT subscription does not provide that API quota. `gpt-5-mini` is the existing default and the recommended starting baseline for these task tools; its access, response time and behaviour must be verified with your actual project. This is not a claim that it is the newest model.

Start two terminals in the repository folder and leave both running:

```sh
# Terminal 1: private server, loopback port 8787
npm run ai:server
```

```sh
# Terminal 2: app, fixed port 5173
npm run dev -- --port 5173 --strictPort
```

Open **http://127.0.0.1:5173/** on that same computer. Use this exact origin/profile consistently because browser storage is per origin. `localhost` also works, but has a separate workspace from `127.0.0.1`.

`npm run ai:server` already loads `.env.server` using Node's `--env-file-if-exists` option. Restart that terminal after changing the file; choose **Check connection** in the app. Variables already exported to the server process take precedence over file values. An empty/missing key reports the connection as unavailable.

## What is and is not needed

| Setting | Local value / purpose |
| --- | --- |
| `WORK_HUB_AI_KEY` | Your real key, only in root `.env.server` or a securely injected server variable. |
| `WORK_HUB_AI_MODEL` | `gpt-5-mini` to start. Model access is project-specific. |
| `WORK_HUB_AI_PORT` | Keep `8787`: the Vite proxy points to this port. |
| `WORK_HUB_APP_ORIGIN` | Leave blank. The local adapter never reads it; it is for the hosted Azure adapter. |
| `VITE_ENTRA_*` | Not needed for local assistant/workspace use; Microsoft integrations remain disabled. |
| Azure login / roles / resources | Not needed locally. |
| Network | The server must reach `https://api.openai.com/v1/responses`; retain normal TLS verification and any approved proxy. |
| Voice | Edge/Chrome with microphone permission on loopback. Browser speech may need its own online service; Windows dictation (`Win+H`) or typing is the fallback. |

Do not put the key in `.env`, `.env.local`, `.env.example`, `.env.server.example`, any `VITE_` variable, portable HTML, frontend source or browser storage. `.env.server.example` is a tracked blank template; `.env.server` is the ignored private file.

The UI's “configured” connection state proves that the adapter has configuration, **not** that the key/model/quota works. The first successful assistant reply verifies the actual upstream connection. If requests fail, check API project permissions/quota and the server connection without sharing keys or logging secret values.

## Git exclusion and file handling

The existing `.gitignore` explicitly contains `.env.server`; Git confirmed the file is not tracked. Normal `git add .` / `git add -A` excludes it. You can verify without showing its contents:

```sh
git check-ignore -v -- .env.server
git ls-files -- .env.server
```

The first command should identify the `.gitignore` rule; the second should print nothing. This prevents ordinary accidental staging, not deliberate `git add -f` or a later ignore-rule change. Do not force-add secret files or copy keys to tracked templates. On Windows keep the file under your own account with normal private user-folder permissions.

Vite's development server denies HTTP access to `.env.server`; the key goes from the local Node process directly to OpenAI. The frontend calls only `/api/assistant` through Vite's loopback proxy. Keep both listeners on loopback.

## Repeat automated validation

```sh
npm run check
npm ci --prefix api
npm run build --prefix api
npx playwright install chromium
npm run test:e2e
npm audit --audit-level=low
npm audit --prefix api --audit-level=low
```

Building the API does not deploy it. The normal browser suite keeps direct file-launch coverage enabled. This managed cloud Chromium needs `PORTABLE_FILE_URL_BLOCKED=1 PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` because its explicit policy blocks `file://`; the exact packaged HTML is still exercised over loopback. No browser policy should be bypassed.

Automated model/speech replies are controlled fixtures. A real project key, real assistant response and physical microphone must be validated separately below.

## Personal acceptance checklist

Use fictional test data. Keep the same tab/conversation for follow-up steps. Mark a row passed only when you see the actual record/state, not just a reassuring reply. Check your computer's local date/timezone first.

| Done | Test | Expected result |
| --- | --- | --- |
| ☐ | Check connection, then ask “What do I actually need to get done today?” | A real reply arrives; it agrees with the Today records. An invalid key/quota produces an honest error. |
| ☐ | Say/type “Create a task called Local test QA package. Victoria asked me to check the assessment criteria. Make it due today and put it in today's focus.” | One task appears in Today with the correct title, notes and local date. Open its details to check. |
| ☐ | “Add a note to that task: Check the learner instructions too.” | The same task gains the note; its original context remains; no duplicate appears. |
| ☐ | “Move that task to next Monday and remove it from today's focus.” | The same task has the intended Monday date, leaves Today and appears in Upcoming. The assistant states the resolved date. |
| ☐ | “Make that task high priority.” Then “Actually, make it low priority.” | The same task's priority changes each time and survives reload. |
| ☐ | “I've completed that task. Outcome: QA check finished.” | It moves to Completed and retains its notes and outcome. “Reopen that task and put it in today's focus” restores the same record to Today. |
| ☐ | “I'm waiting for Prakash on that task. Follow up tomorrow.” | Waiting view shows the person and correct follow-up date without implying a message was sent. |
| ☐ | Create “Local test review A” and “Local test review B”, then ask “Complete the local test review.” | The assistant asks which record. Neither changes until you clarify “The second one.” |
| ☐ | Start dictation, allow the microphone, speak a short new test task, stop, inspect the transcript and send. | Multiple spoken phrases remain intact; exactly one task is created. Test typing/`Win+H` if browser speech is unavailable. |
| ☐ | “Create a Local test launch project with notes: QA rehearsal.” Link the QA task to it. | Projects shows the context and linked task, including completion history. |
| ☐ | Start a new conversation, then reload and revisit Today, Projects and Completed. | Records/history remain independently of the old chat. |
| ☐ | Stop the server, try a message, restart it, check connection and resume the paused request. | An honest failure is shown; confirmed changes remain; resume does not duplicate a saved action. |

Use Settings to back up records. Deleting a test task moves it to recoverable Trash. Browser-local IndexedDB is not multi-device sync or an organisational backup. Clear only fictional test data; resetting the workspace also removes its conversation/projects/history.

Keep Azure deployment paused until these real-device/model checks are satisfactory.
