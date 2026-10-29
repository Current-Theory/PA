# Azure hosting and later Teams personal tab

## Azure Static Web Apps

1. Have EarnLearn IT approve an Azure subscription, region, resource group, environment/domain, repository access and deployment identity. No Azure credentials are required to run this demo locally.
2. Create a Static Web App connected to this repository. Set app location `/`, no API location, output `dist`. Build with Node 24 using `npm ci && npm run build`.
3. Review the Azure-generated GitHub Actions workflow. Store its deployment token in the GitHub Actions secret Azure generates; never in `.env`, source code or chat. An organisation-approved OIDC deployment workflow can replace the generated token workflow.
4. Use preview environments for review with fictional data. Production requires HTTPS. `public/staticwebapp.config.json` is copied into `dist` with baseline headers and static navigation fallback.
5. For future live mode, set the three **public** `VITE_ENTRA_*` build values and rebuild, then register that exact hosted origin/redirect URI in Entra. Vite replaces these values at build time. Never put a client secret or token into any `VITE_` variable.
6. The current demo CSP permits same-origin connections only. When implementing live mode, explicitly permit `https://login.microsoftonline.com` and `https://graph.microsoft.com` for connections and the Entra login origin for sign-in frames, plus only the exact additional tenant/CDN origins proven necessary. Keep script sources restricted and test MSAL under the deployed CSP. No Graph connectivity is implied by adding IDs alone.
7. Validate capture, persistence, PWA installation, update prompt and offline behaviour on the real hosted origin. The supplied CI validates the build and Chromium workflow; it does not deploy an Azure resource.

The frontend has no backend secrets. Demo content persists separately per browser profile/origin. Access protection for an organisational deployment is an IT decision and must precede use with work data. Do not treat a public static deployment with demo persistence as a secured production task system.

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
