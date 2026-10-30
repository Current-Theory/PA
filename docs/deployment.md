# Azure hosting and later Teams personal tab

## Minimum resource to create — final setup only

Create **one Azure Static Web App** (`Microsoft.Web/staticSites`) with its **managed Azure Functions API**. A separate standalone Function App or database resource is not required for this implementation. Free is sufficient for a personal test with preconfigured Microsoft sign-in and manually invited roles; use Standard if EarnLearn requires a custom single-tenant authentication registration or other production features. Choose the subscription, resource group, name and region in your approved Azure account; none is preselected or fabricated here.

Minimum binding/settings:

1. Source: `Current-Theory/PA`, branch `main`. Use the prepared workflow template; it builds from this checkout, uploads `dist` and built `api`, and targets managed API runtime `node:22` (build runner Node 24).
2. API application setting **`WORK_HUB_AI_KEY`**: an actual authorised OpenAI project key, entered securely. The app never creates or exposes one.
3. API application setting **`WORK_HUB_AI_MODEL`**: a Responses/function-calling model available to that project; default `gpt-5-mini` is configurable and needs live verification.
4. API application setting **`WORK_HUB_APP_ORIGIN`**: the exact HTTPS origin Azure gives the app, without a trailing slash. No guessed URL is supplied.
5. Invite the intended Microsoft account with custom role **`work-hub-user`**. The gateway and handler both enforce it; anonymous or merely signed-in users cannot call the paid API.
6. Put the actual deployment token issued by that Static Web App into the Actions secret **`AZURE_STATIC_WEB_APPS_API_TOKEN`**, as referenced by the template. Do not put a token or API key in a repository file or chat.

Stop before binding/deploying until these resources and values exist. This repository contains no invented resource IDs, URLs, credentials or live deployment. The resource serves the UI and authenticated AI transport; task/project persistence remains in the user's browser IndexedDB, not an Azure database. A central/multi-device store would be a separately approved adapter.

Microsoft's [plan comparison](https://learn.microsoft.com/azure/static-web-apps/plans) documents managed Functions and preconfigured/custom authentication choices. The official source was checked during implementation.

## Azure Static Web Apps

1. Have EarnLearn IT approve an Azure subscription, region, resource group, environment/domain, repository access and deployment identity. No Azure credentials are required to run this demo locally.
2. Create a Static Web App connected to this repository. The frontend builds from `/` into `dist`; the optional authenticated assistant backend is in `api/`. Build both with Node 24 using `npm ci && npm ci --prefix api && npm run build && npm run build --prefix api`. A static-only demo can omit the API, in which case manual workspace use still works, but connected AI is unavailable.
3. Review the Azure-generated GitHub Actions workflow. Store its deployment token in the GitHub Actions secret Azure generates; never in `.env`, source code or chat. An organisation-approved OIDC deployment workflow can replace the generated token workflow.
4. Use preview environments for review with fictional data. Production requires HTTPS. `public/staticwebapp.config.json` is copied into `dist` with baseline headers and static navigation fallback.
5. For future live mode, set the three **public** `VITE_ENTRA_*` build values and rebuild, then register that exact hosted origin/redirect URI in Entra. Vite replaces these values at build time. Never put a client secret or token into any `VITE_` variable.
6. The current demo CSP permits same-origin connections only. When implementing live mode, explicitly permit `https://login.microsoftonline.com` and `https://graph.microsoft.com` for connections and the Entra login origin for sign-in frames, plus only the exact additional tenant/CDN origins proven necessary. Keep script sources restricted and test MSAL under the deployed CSP. No Graph connectivity is implied by adding IDs alone.
7. Validate capture, persistence, PWA installation, update prompt and offline behaviour on the real hosted origin. The supplied CI validates the build and Chromium workflow; it does not deploy an Azure resource.

The frontend has no backend secrets. Demo content persists separately per browser profile/origin. Access protection for an organisational deployment is an IT decision and must precede use with work data. Do not treat a public static deployment with demo persistence as a secured production task system.

## Secure automatic assistant

`api/` implements an Azure Static Web Apps managed Functions backend with a Node 22 runtime. The gateway and handler both require the **work-hub-user** custom role. Invite the intended Microsoft account to that role using the Static Web App's role-management screen. Do not publish the Function independently of the SWA gateway: its reserved authentication header is trusted only because the managed gateway validates and injects it.

Set these **API application settings**, never browser build variables:

- `WORK_HUB_AI_KEY`: the authorised OpenAI project API key, stored securely.
- `WORK_HUB_AI_MODEL`: a model supporting Responses function calling (default `gpt-5-mini`; verify availability).
- `WORK_HUB_APP_ORIGIN`: the app's exact HTTPS origin, with no trailing slash.

Use [the prepared deployment workflow](azure-deploy-workflow.yml) after an approved Static Web App and its deployment credential exist. It builds the frontend and API together from this checkout, then uploads `dist` and the built `api` directory with both platform build steps skipped. This avoids relying on an isolated API build to find shared TypeScript sources outside `api/`. Retain the API package/production dependencies and `host.json` in that upload. CI builds this API bundle, but does not prove an Azure deployment succeeded.

In the hosted UI, sign in using the separate-tab link in the assistant panel, return and choose **Check connection**, then send a natural-language message. Verify successful tool calls and database-confirmed actions, denied roles, wrong origins, throttling, billing and model access on the actual Azure origin before calling the connection live. No Azure target, deployment credential or API key was available in the implementation environment; these remain external prerequisites.

## PWA operations

The service worker precaches the static app shell and icons. It never caches Graph/auth responses. A new version prompts the user to save edits before reload. HTML and `sw.js` are served with revalidation headers; content-hashed assets remain suitable for long caching. A service worker or open browser process must not be assumed to survive an environment restart.

Browser storage is not an organisational backup. Sign-out/purge/account-switch semantics for live mode must be designed before enabling Microsoft data. Corporate Windows app-install policies can prevent PWA installation even when the manifest is valid.

## Teams personal-tab route

Use this same HTTPS app and responsive UI, not a separate Teams frontend. Browser use stays independent of Teams.

1. Register a Teams application package containing approved icons, app ID, names and a **personal static tab** with `contentUrl` pointing at the approved hosted application, and `websiteUrl` for the same browser view. List the exact hosted origin in `validDomains`.
2. Host headers already allow Microsoft Teams and `*.cloud.microsoft` frame ancestors. Confirm current Microsoft host-domain guidance and restrict to approved domains; do not add `X-Frame-Options: DENY`/`SAMEORIGIN` for a tab deployment.
3. Add a small optional TeamsJS host adapter to initialise Teams only when actually hosted there. No TeamsJS code is required for today’s demo. Test iframe detection, theme, viewport, back navigation and focus using the same components.
4. Teams iframe authentication differs from normal browser redirects. Choose an approved Teams SSO/nested-auth strategy, supported MSAL flow and app registration settings. Do not assume a browser-only redirect flow will work in an iframe. Do not grant Graph or Teams chat permissions merely to render a personal tab.
5. Validate Windows Teams, Teams web, Edge, Chrome and Surface/narrow layouts. Package/publish through the organisation’s app catalogue after IT review. The repository does not claim Teams SSO or catalogue publication is complete.
