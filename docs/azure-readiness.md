# Azure Static Web Apps Free readiness

Prepared and verified 2 November 2026 (Pacific/Auckland). **Ready to connect Azure: YES.** Nothing deployed, no Azure resources created, and no workflow activated.

## Files changed

- `public/staticwebapp.config.json`: frontend and API role rules, Microsoft login, denial response, public auth paths, no-store headers, authorised deep-link rewrite.
- `public/access-denied.html`: public denial page with Microsoft sign-in and sign-out.
- `public/assistant-connected.html`: correct invitation role name.
- `api/src/handler.ts`: validate SWA principal, Microsoft provider and invited role before handling any action.
- `api/src/index.ts`: corrected managed gateway role documentation.
- `src/lib/hostedAuth.ts`: uncached SWA session check and Microsoft/role validation.
- `src/main.tsx`: verify hosted session before importing and mounting the application; fail closed if unavailable.
- `src/components/Settings.tsx`: hosted sign-out link and accurate online/authentication wording.
- `build/pwa.ts`: retire old shell caches; no cached navigation or offline shell.
- `tests/hosted-auth.test.ts`: route, session, provider, role and all-action API rejection coverage.
- `tests/hosted-assistant.test.ts`: updated role/provider fixtures; existing successful AI and origin/limit checks.
- `tests/hosted-auth.spec.ts`: browser allowed/denied/anonymous/session-failure checks.
- `tests/hosted-fixture.ts`: invited Microsoft session fixture for existing UI workflows.
- `tests/assistant.spec.ts`: use hosted fixture.
- `tests/workflow.spec.ts`: use hosted fixture; verify uncached worker and authenticated CSP flow.
- `README.md`, `docs/deployment.md`, `docs/azure-readiness.md`: current behaviour, verification and exact Azure connection prerequisites.

## Verification

- `npm run check`: passed lint, TypeScript, 45 unit tests across 7 files, and production frontend build.
- `npm run build --prefix api`: passed managed Functions bundle build.
- `npm run build:portable`: passed; generated download was restored to avoid changing the distributed demo in this hosting change.
- Chromium Playwright: all 22 existing assistant/workflow tests passed. All 4 hosted authentication tests passed after fixing the allowed-user test to explicitly navigate to Today rather than expecting it at the default Assistant URL. Total: 26 distinct passing browser checks.
- Production bundles scanned for server API key variable and OpenAI project-key patterns: no matches.
- `git diff --check`: passed.

The browser session tests mock `/.auth/me`; Vite preview does not implement the Azure gateway. Route coverage tests inspect the actual deployment configuration. No live Microsoft login, invitation, Azure gateway, deployment, or OpenAI billing call was performed. These require the connected Azure origin and secure API settings.

## Boundary and remaining checks

The gateway requires `workhub_user` on all app paths and `/api/*`; `authenticated` alone grants no access. The frontend additionally requires the `aad` provider and approved session. Every hosted API action checks its own injected principal, `aad`, nonempty user ID, `authenticated` and `workhub_user` before parsing bodies or calling OpenAI. The key is server-side only. Login/logout/callback/invitation paths and the denial page remain public. The local loopback development adapter is not deployed; the portable demo is a separate local artifact.

No code blockers remain for connection. After separately authorised deployment, verify actual anonymous redirects, denied accounts, accepted Microsoft invitations, allowed deep links, each API action, logout and OpenAI model access on Azure. Existing browser-local records are not erased by sign-out. Free provides invited access with built-in multi-tenant Microsoft authentication; it does not add custom tenant-restricted authentication. No database, App Service, VM, container or paid Azure service is required.

See `docs/deployment.md`, “Information needed to connect Azure”, for subscription/resource choices, repository and branch, Microsoft invitees, resulting origin, and secure settings/token entry. Never send keys or deployment tokens in chat.
