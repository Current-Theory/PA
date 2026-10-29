# Validated delivery

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
