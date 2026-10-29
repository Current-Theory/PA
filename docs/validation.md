# Validated delivery

## Assisted capture and wordmark — 30 October 2026

- Lint, strict typecheck, production build and the Azure managed API bundle passed.
- The API's frozen-lockfile dependency installation passed; its dependency audit reported zero known vulnerabilities.
- **23 domain/API tests passed**: proposal parsing/validation, canonical and atomic capture, retained notes/checklists, local server boundaries, and hosted role/origin/per-user limits.
- **22 browser tests passed; 1 direct file-navigation test skipped** because the managed Chromium URL policy blocks `file://`, as documented below. The packaged HTML was still exercised separately over loopback with no external subresources.
- Browser coverage includes importing the package-design/QA example, staying on the current workstream, review before saving, Today placement, selected-workstream quick capture, microphone refusal, multiple final speech segments, stale-proposal invalidation, JSON-file import, mobile accessibility and separate-tab hosted sign-in with note preservation.
- The native Node adapter was started successfully; its live status reported `ready: false` and capture returned HTTP 503 with no API key, instead of pretending to generate suggestions.
- OpenAI request/response and speech tests used controlled fixtures. A real microphone session, real OpenAI model response, Azure gateway sign-in and Azure deployment were **not** validated: no API key or Azure deployment identity/target was supplied.
- Automatic API return has implemented frontend/server/managed-Azure code, but is not live. The portable download offers the existing-account ChatGPT copy/import fallback.

Refinements from testing: quick capture respects the chosen workstream; multiple speech segments append correctly; modifying the original note invalidates old proposals; successfully imported JSON collapses into a compact confirmation so the review takes precedence; an invalid draft or failed write creates no partial batch. The Work Hub name remains unchanged and the EarnLearn placeholder wordmark spacing has been improved.

## Downloadable demo — 30 October 2026

The ready-to-open ZIP is in `downloads/EarnLearn-Work-Hub.zip`. Its exact embedded HTML was extracted and tested through a loopback harness: capture, notes, outcome, completion history and persistence passed, including editing while browser networking was offline. No external scripts, styles, fonts or other subresources were requested. ZIP extraction and Windows-safe filenames passed. Runtime notices are included in the archive.

The expanded browser run completed with **13 passed, 1 skipped**. Direct `file://` navigation is explicitly blocked by this cloud Chromium’s managed URL policy; that one test was skipped using `PORTABLE_FILE_URL_BLOCKED=1` after observing `ERR_BLOCKED_BY_ADMINISTRATOR`. No browser policy was changed. File-based launch itself remains unverified in this managed instance; normal CI leaves that test enabled. Organisational browser policies on the user’s device may also restrict file launch/storage.

Lint, strict typecheck, eight provider/domain tests, production build and portable build passed. The dependency audit reported zero known vulnerabilities after adding the ZIP packager. Earlier hosted-build results remain below.

## Initial hosted-build validation

Validated on 29 October 2026 in the prepared cloud environment using Node 24.19.0, npm 11.9.0 and system Chromium 154.0.8037.57. Browser contexts used Pacific/Auckland for date-sensitive workflows.

| Check | Result |
| --- | --- |
| Frozen dependency installation, `npm ci --no-audit --no-fund --prefer-offline` | Passed |
| ESLint with zero warnings | Passed |
| TypeScript strict type check | Passed |
| Vitest provider/domain suite | 8 passed |
| Vite production build and generated static-shell service worker | Passed |
| Playwright production browser suite | 11 passed |
| WCAG A/AA automated axe scans (Today, search, task drawer, settings, mobile drawer) | No violations in tested states |
| Responsive overflow (1920, 1366, 820, 390 and 320 widths across suite) | Passed |
| Offline service-worker reload and offline demo capture | Passed |
| Production Azure CSP with real rendered capture operation | Passed |
| Development startup and browser task capture | Passed |
| `npm audit --audit-level=low`, all dependency classes | 0 known vulnerabilities reported |

The eleven browser tests cover capture/edit/checklist/resource/outcome/completion/reopening and reload persistence; waiting/follow-up and workstream filtering; completion undo; keyboard focus and invalid URLs; desktop accessibility; mobile navigation/drawer; offline PWA; combined filters/history; workstream rename/removal/reset; laptop/narrow layouts and manifest icons; and the Azure production content security policy.

Screenshots in `docs/screenshots/` show the actual tested fictional workspace. CI repeats the quality checks and uses Playwright’s installed Chromium. No tests were skipped or marked expected-failure in these suites.

## Boundaries

- Graph access, Entra authentication, Planner/To Do live writes and tenant consent have not been tested: the live providers are deliberately unimplemented scaffolds.
- No Azure resource or Teams app was deployed/published. Deployment instructions and a CI workflow are supplied.
- Automated Chromium/a11y checks do not replace actual Edge, Windows PWA installation, Surface, screen-reader and organisational security testing.
- Brand tokens and placeholder wordmark require brand-owner validation against approved assets.
- Reusable environment instructions were saved to the environment draft. The running instance and saved instructions were tested; publication and a fresh task restoring a published snapshot were not performed.
