# Azure hosting and later Teams personal tab

## Minimum resource to create — final setup only

Create **one Azure Static Web App** (`Microsoft.Web/staticSites`) with its **managed Azure Functions API**. A separate standalone Function App or database resource is not required for this implementation. Free is sufficient for a personal test with preconfigured Microsoft sign-in and manually invited roles; use Standard if EarnLearn requires a custom single-tenant authentication registration or other production features. Choose the subscription, resource group, name and region in your approved Azure account; none is preselected or fabricated here.

Minimum binding/settings:

1. Source: `Current-Theory/PA`, branch `main`. Use the prepared workflow template; it builds from this checkout, uploads `dist` and built `api`, and targets managed API runtime `node:22` (build runner Node 24).
2. API application setting **`WORK_HUB_AI_KEY`**: an actual authorised OpenAI project key, entered securely. The app never creates or exposes one.
3. API application setting **`WORK_HUB_AI_MODEL`**: a Responses/function-calling model available to that project; default `gpt-5-mini` is configurable and needs live verification.
4. API application setting **`WORK_HUB_APP_ORIGIN`**: the exact HTTPS origin Azure gives the app, without a trailing slash. No guessed URL is supplied.
5. Invite the intended Microsoft account with custom role **`workhub_user`**. The gateway and handler both enforce it; anonymous or merely signed-in users cannot call the paid API.
6. Put the actual deployment token issued by that Static Web App into the Actions secret **`AZURE_STATIC_WEB_APPS_API_TOKEN`**, as referenced by the template. Do not put a token or API key in a repository file or chat.

Stop before binding/deploying until these resources and values exist. This repository contains no invented resource IDs, URLs, credentials or live deployment. The resource serves the UI and authenticated AI transport; task/project persistence remains in the user's browser IndexedDB, not an Azure database. A central/multi-device store would be a separately approved adapter.

Microsoft's [plan comparison](https://learn.microsoft.com/azure/static-web-apps/plans) documents managed Functions and preconfigured/custom authentication choices. The official source was checked during implementation.

## Azure Static Web Apps

1. Have EarnLearn IT approve an Azure subscription, region, resource group, environment/domain, repository access and deployment identity. No Azure credentials are required to run this demo locally.
2. Create a Static Web App connected to this repository. The frontend builds from `/` into `dist`; the optional authenticated assistant backend is in `api/`. Build both with Node 24 using `npm ci && npm ci --prefix api && npm run build && npm run build --prefix api`. A static-only demo can omit the API, in which case manual workspace use still works, but connected AI is unavailable.
3. Review the Azure-generated GitHub Actions workflow. Store its deployment token in the GitHub Actions secret Azure generates; never in `.env`, source code or chat. An organisation-approved OIDC deployment workflow can replace the generated token workflow.
4. Use preview environments for review with fictional data. Production requires HTTPS. `public/staticwebapp.config.json` is copied into `dist` with security headers and an authorised catch-all route rewrite. There is no navigationFallback, because SWA bypasses route rules for fallback requests.
5. Optional Microsoft Graph integration is separate from SWA sign-in and is not enabled by this preparation. For future Graph live mode, set the three **public** `VITE_ENTRA_*` build values and rebuild, then register that exact hosted origin/redirect URI in Entra. Vite replaces these values at build time. Never put a client secret or token into any `VITE_` variable.
6. The current demo CSP permits same-origin connections only. When implementing live mode, explicitly permit `https://login.microsoftonline.com` and `https://graph.microsoft.com` for connections and the Entra login origin for sign-in frames, plus only the exact additional tenant/CDN origins proven necessary. Keep script sources restricted and test MSAL under the deployed CSP. No Graph connectivity is implied by adding IDs alone.
7. Validate capture, persistence, PWA installation, update prompt and offline behaviour on the real hosted origin. The supplied CI validates the build and Chromium workflow; it does not deploy an Azure resource.

The frontend has no backend secrets. Demo content persists separately per browser profile/origin. Hosted access requires Microsoft sign-in and an invitation granting workhub_user. Do not treat a public static deployment with demo persistence as a secured production task system.

## Secure automatic assistant

`api/` implements an Azure Static Web Apps managed Functions backend with a Node 22 runtime. The gateway and handler both require the **workhub_user** custom role. Invite the intended Microsoft account to that role using the Static Web App's role-management screen. Do not publish the Function independently of the SWA gateway: its reserved authentication header is trusted only because the managed gateway validates and injects it.

Set these **API application settings**, never browser build variables:

- `WORK_HUB_AI_KEY`: the authorised OpenAI project API key, stored securely.
- `WORK_HUB_AI_MODEL`: a model supporting Responses function calling (default `gpt-5-mini`; verify availability).
- `WORK_HUB_APP_ORIGIN`: the app's exact HTTPS origin, with no trailing slash.

Use [the prepared deployment workflow](azure-deploy-workflow.yml) after an approved Static Web App and its deployment credential exist. It builds the frontend and API together from this checkout, then uploads `dist` and the built `api` directory with both platform build steps skipped. This avoids relying on an isolated API build to find shared TypeScript sources outside `api/`. Retain the API package/production dependencies and `host.json` in that upload. CI builds this API bundle, but does not prove an Azure deployment succeeded.

In the hosted UI, sign in using the separate-tab link in the assistant panel, return and choose **Check connection**, then send a natural-language message. Verify successful tool calls and database-confirmed actions, denied roles, wrong origins, throttling, billing and model access on the actual Azure origin before calling the connection live. Azure target settings and a deployment credential remain external prerequisites. Workspace secrets are not automatically Azure application settings.

## PWA operations

The hosted worker does not cache or intercept requests. It retires earlier earnlearn-shell caches so offline shell access cannot bypass authentication. Hosted responses use Cache-Control: no-store. PWA installation remains available, but opening the hosted app requires connectivity. A service worker or open browser process must not be assumed to survive an environment restart.

Browser storage is not an organisational backup. Sign-out/purge/account-switch semantics for live mode must be designed before enabling Microsoft data. Corporate Windows app-install policies can prevent PWA installation even when the manifest is valid.

## Teams personal-tab route

Use this same HTTPS app and responsive UI, not a separate Teams frontend. Browser use stays independent of Teams.

1. Register a Teams application package containing approved icons, app ID, names and a **personal static tab** with `contentUrl` pointing at the approved hosted application, and `websiteUrl` for the same browser view. List the exact hosted origin in `validDomains`.
2. Host headers already allow Microsoft Teams and `*.cloud.microsoft` frame ancestors. Confirm current Microsoft host-domain guidance and restrict to approved domains; do not add `X-Frame-Options: DENY`/`SAMEORIGIN` for a tab deployment.
3. Add a small optional TeamsJS host adapter to initialise Teams only when actually hosted there. No TeamsJS code is required for today’s demo. Test iframe detection, theme, viewport, back navigation and focus using the same components.
4. Teams iframe authentication differs from normal browser redirects. Choose an approved Teams SSO/nested-auth strategy, supported MSAL flow and app registration settings. Do not assume a browser-only redirect flow will work in an iframe. Do not grant Graph or Teams chat permissions merely to render a personal tab.
5. Validate Windows Teams, Teams web, Edge, Chrome and Surface/narrow layouts. Package/publish through the organisation’s app catalogue after IT review. The repository does not claim Teams SSO or catalogue publication is complete.

## Prepared authentication boundary (Free)

All frontend routes, including direct deep links, index and bundled assets, require exactly the custom invited role `workhub_user`. The default `authenticated` role alone grants no application access. `/.auth/*` stays reachable for Microsoft login, callback, session, logout and invitation acceptance; GitHub login is disabled. Authentication uses the built-in `aad` provider: no custom Entra registration, client secret or paid authentication feature is required. Free's built-in provider permits Microsoft accounts from multiple tenants; access is controlled by explicit invitations rather than tenant restriction.

Anonymous gateway requests redirect to Microsoft login. Signed-in users without the custom role get the public `/access-denied` page (403 override), with sign-out and Microsoft sign-in links. The production bootstrap additionally checks `/.auth/me` for a nonempty user ID, `identityProvider: aad`, `authenticated` and `workhub_user` before importing/mounting the application. Network/session-check failures keep the UI locked. Settings includes a sign-out link. Development and the separately downloadable portable demo are not Azure deployments and retain their local workflow; never upload portable artifacts as the hosted site.

`/api` and `/api/*` have independent gateway role rules before the frontend catch-all. The single managed Function serves status, capture and chat; every action passes the same principal guard before status information, body parsing, validation or OpenAI calls. Missing/malformed principals, non-Microsoft identities and missing roles fail closed with 401 from the handler. The gateway may apply the site's login/error response overrides before a request reaches that handler. Same-origin checks, payload validation, timeout and instance-local throttling remain in place. Throttling is not a global usage budget; configure an OpenAI project spend limit separately.

The reserved `x-ms-client-principal` header is trusted only behind SWA's managed gateway, which supplies the identity. Do not deploy this as a public standalone Function or expose the loopback development adapter. The key is read from server process settings and never from Vite variables. No database, App Service, VM, container or paid Azure resource is introduced. Browser IndexedDB remains the local persistence mechanism; sign-out does not erase existing local records or content already displayed in an open tab. Use a trusted browser profile for work data.

### Information needed to connect Azure

- Approved Azure subscription, resource group (existing or desired new name), resource name and supported managed-API region. Select **Free**.
- Confirm the GitHub repository and branch (currently documented as `Current-Theory/PA`, `main`), and authorise the Azure/GitHub connection when prompted.
- Microsoft account sign-in email addresses to invite, with `workhub_user`; send invitations using the **aad** provider and have recipients accept them.
- The resulting Azure HTTPS origin for `WORK_HUB_APP_ORIGIN`.
- An authorised OpenAI project key entered directly into Azure configuration as `WORK_HUB_AI_KEY`, and the desired available Responses model for `WORK_HUB_AI_MODEL` (default `gpt-5-mini`). Do not send the key in chat.
- The SWA deployment token placed directly into the repository Actions secret `AZURE_STATIC_WEB_APPS_API_TOKEN`. Do not send this token in chat.

Connection and deployment remain separate user-authorised steps. Keep the template in docs until deployment is requested. After deployment, verify an anonymous browser, an uninvited Microsoft account, an invited Microsoft account, sign-out, deep links, each API action, actual model access and secret settings on the real origin. Local tests cannot establish Azure gateway behaviour or live login success.
