# Talk it through: capture with ChatGPT

The assistant panel sits beside quick capture and on every workstream card. Opening it keeps the current page and workstream behind the panel. The EarnLearn / Work Hub name is unchanged; the placeholder wordmark spacing has been refined.

## What works in the download now

1. Choose a workstream, or use its **Capture** button.
2. Type the context into **What needs to happen?** Browser dictation is available when supported; Windows dictation (`Win+H`) also works in that text box. Microphone capture is explicitly user initiated.
3. Choose **Copy prompt for ChatGPT**, then **Open ChatGPT**. This opens the official ChatGPT site in a separate tab without putting task text in a URL. Paste the prepared prompt there. You can use ChatGPT’s own voice mode to add context, then ask for the JSON response in the supplied format.
4. Return to the panel, choose **Import ChatGPT reply**, and paste the JSON or select a JSON file.
5. Review/edit the proposed titles, notes, workstreams, due dates, priority, waiting information and checklist. Remove any unwanted proposal and choose which actions appear in **Focus Today**.
6. Add the tasks. The entire batch saves atomically: a failure creates no partial import. Your original typed/dictated note is retained in task notes alongside the proposed context. The panel closes back to your workstream. **Today** shows the actions you chose to focus on.

The app cannot embed or read a signed-in ChatGPT web session. It does not claim an automatic return from a separate ChatGPT tab. No content is automatically copied, sent or saved merely by opening the panel. Clipboard denial provides a selectable prompt rather than blocking the workflow. Closing the panel keeps the original note in memory during the current app session; proposals are not saved until you add them.

Browser speech recognition may use the browser vendor’s online speech service. Availability varies across Edge/Chrome, operating system, device policy and origin. No raw audio is stored or sent by this application. Dictation permission/network failures keep existing text and provide a typing/Windows-dictation fallback. Browser microphone policy is restricted to the hosting origin; camera/geolocation remain disabled.

## Automatic return inside the panel

A local server adapter is implemented for **OpenAI Responses API** structured output. A ChatGPT subscription does not supply API credit or an API key. There is no supported reuse of the user’s ChatGPT browser session as an API credential.

The API key must exist **only on the server** as `WORK_HUB_AI_KEY`. Never put it in a `VITE_` variable, the downloadable HTML, a task, a URL or a commit. The model is configurable as `WORK_HUB_AI_MODEL` (default `gpt-5-mini`); verify the selected model’s availability and structured-output support in the authorised OpenAI project.

For local development, securely inject these server variables, or create the ignored `.env.server` from `.env.server.example` and fill it locally. Then, in separate terminals:

```sh
npm run ai:server
npm run dev
```

The Node 24 adapter binds to **loopback only**, port 8787, and Vite proxies `/api/assistant` to it. It respects the inherited HTTPS proxy with Node’s `--use-env-proxy`. The normal app reads a safe same-origin status endpoint. When configuration is present it offers **Suggest tasks**; this sends only the note, configured workstream names, selected workstream and local calendar date. It does not send the task database or automatically mutate any provider. It uses `store: false`, no external tools and a strict JSON schema. The response is validated and still requires user review/addition.

The service restricts origins, request sizes, concurrency and per-client request rate; it aborts timed-out/disconnected requests. It never returns the key or raw upstream error bodies. Invalid/incomplete/refused responses produce an error, not a fictional successful suggestion. All provider mutations remain local demo operations; this does not enable Microsoft integration.

## Hosting and IT requirements

The portable file deliberately disables the API connection and contains no key or server configuration. It retains the fully working ChatGPT copy/import path. Automatic in-panel return needs a **hosted** UI and same-origin server route.

The supplied loopback adapter is not a public authenticated service. A deployable Azure Static Web Apps **managed Functions** backend is supplied in `api/`, using the same Responses service. The static app gateway restricts `/api/assistant/*` to the custom **work-hub-user** role. The backend also checks the gateway-injected principal for both `authenticated` and `work-hub-user`, enforces the configured origin, and applies per-approved-user request limits. It must run behind the SWA managed gateway, which validates login and strips client-supplied reserved headers; do not deploy the anonymous-trigger Function as a standalone public service.

EarnLearn IT must approve OpenAI use for work content, data handling/billing/model/project access and server-secret storage. It must provide an Azure Static Web App deployment target, deploy its managed API, invite the intended Microsoft account with the **work-hub-user** role, and set API application settings `WORK_HUB_AI_KEY`, `WORK_HUB_AI_MODEL` and `WORK_HUB_APP_ORIGIN` (the exact HTTPS app origin, no trailing slash). No Azure deployment credentials or live API key were available during implementation. No public hosted deployment or live model call is claimed.

The panel offers a hosted sign-in link in a separate tab and a **Check connection** action; this preserves the original note and workstream rather than losing them during sign-in. The download still uses copy/import. See [deployment](deployment.md) for build/upload details.

The static app’s CSP needs only a same-origin connection to that backend. The server needs outbound HTTPS to `api.openai.com`; no browser access to the OpenAI credential is necessary. Existing Microsoft permissions do not grant OpenAI access. OpenAI/API costs are separate from ChatGPT subscription costs.

## Validation boundaries

Tests validate parsing, bounds, preservation of context, canonical provider routing, all-or-nothing writes, origin/rate/key/error handling and structured API request format. Browser tests use controlled API/speech fixtures to exercise review, import, failure handling, dictation segments and mobile accessibility; they are not evidence of a real model response or microphone capture. No live OpenAI request or real microphone session is claimed without the required configuration/device access.

Suggestions are untrusted proposals. The parser rejects unexpected task identity fields, invalid dates/statuses and excessive tasks; unknown workstreams are clearly flagged for review. AI cannot create new workstreams, complete tasks, assign Microsoft users, send messages or call arbitrary tools through this flow.
