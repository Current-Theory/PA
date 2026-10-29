# Microsoft 365 integration and IT handoff

## Present boundary

No Microsoft tasks are currently read or written. The complete interface uses `MockTaskProvider`. `MicrosoftTodoProvider` and `MicrosoftPlannerProvider` are intentional stubs that throw, and advertise no supported writes. `GraphClient` and explicit MSAL initialization are prepared, not tenant-tested. Do not replace failures with demo data in a live connection.

## Exact permissions proposed

Use a single-tenant **SPA** registration and delegated user access. Start with read-only validation and request write access only when releasing task mutation.

| Scope | Why / when |
| --- | --- |
| `openid` | Sign-in ID token, requested as part of the MSAL OIDC flow. |
| `profile` | Signed-in display name/claims; use these rather than the demo profile. |
| `offline_access` | Standard MSAL authorization-code flow refresh-token capability, subject to organisational policy. This is not offline task sync. |
| `Tasks.Read` | Read the signed-in user’s To Do tasks and Planner tasks assigned to them during read-only validation. |
| `Tasks.ReadWrite` | Required for the intended production create/update/complete/checklist workflow in To Do and accessible Planner plans. Replaces the need for a separate task-read consent in the write-capable app. |

The code defines Graph scopes `Tasks.Read` and `Tasks.ReadWrite` for incremental selection. MSAL adds its OIDC scopes during authorization; do not request both read and write scopes merely to accumulate grants. No consent is requested by the demo.

**Not requested:** `Mail.Read`, `Mail.ReadWrite`, `Calendars.Read`, `Group.Read.All`, `Group.ReadWrite.All`, `Directory.Read.All`, SharePoint/Sites permissions, Teams chat permissions or application permissions. `User.Read` is not needed to display the ID-token name; request it only if adding a separately justified `/me` profile call. Existing accessible plan/bucket IDs avoid group-directory enumeration. Verify endpoint-specific delegated requirements in current Microsoft documentation before tenant rollout.

Flagged Outlook mail is not assumed to be exposed through every To Do endpoint or tenant. Verify the actual task ecosystem first. If direct flagged-email support later needs `Mail.Read`, scope and approve it as a distinct feature; do not silently introduce mail access. Teams source URLs are retained when exposed by Microsoft, without reading meeting/chat bodies.

## IT prerequisites

1. Single-tenant Entra registration with SPA platform and exact HTTPS production and approved local redirect/logout URIs. Authorization code + PKCE, handled by MSAL. No browser client secret. No separate Work Hub password.
2. Provide public client ID, tenant ID and redirect URI as build environment values; review delegated `Tasks.ReadWrite` consent under tenant policy. Ensure To Do/Planner licensing and access to test lists/plans. Use fictional test records first.
3. Confirm conditional access, MFA, SSO expectations, account lifecycle, popup/redirect choice, sign-out behaviour and token lifetime policies. Existing Microsoft login helps but silent SSO is never guaranteed by the app.
4. Approve Azure hosting, deployment identity, CSP changes, domain, data classification, retention and supported browser policy.
5. Approve storage/sync semantics for view-only metadata. Do not make a competing task database. No local cache of confidential live task content by default.
6. Test assigned-task visibility, shared plan writes, Outlook flagged-task behaviour and permissions against the organisation’s actual tenant. Some Planner plan types/features are not exposed by the basic Planner API.

## v1.0 provider implementation route

Use `https://graph.microsoft.com/v1.0` only for production-critical operations. This application never depends on Planner My Day beta APIs.

| Provider | Endpoints / behaviour to implement |
| --- | --- |
| To Do | `GET /me/todo/lists`, `GET/POST /me/todo/lists/{listId}/tasks`, `GET/PATCH /me/todo/lists/{listId}/tasks/{taskId}`. Preserve list/task IDs; map task body, importance, status, due/completed dateTime and timezone. |
| To Do checklist/resources | `/me/todo/lists/{listId}/tasks/{taskId}/checklistItems` and `/linkedResources` collections. Use returned source links; never invent message IDs or deep links. |
| Planner assigned tasks | `GET /me/planner/tasks`. Hydrate `/planner/tasks/{id}/details` only where required; retain plan and bucket IDs. |
| Planner writes | `POST /planner/tasks`, `PATCH /planner/tasks/{id}`, and `PATCH /planner/tasks/{id}/details`. Use `percentComplete` for progress, due dates, details description/checklist/references and per-resource ETags. Creation requires an accessible plan ID. |
| Planner plans/buckets | `/planner/plans/{planId}` and `/planner/plans/{planId}/buckets` for explicitly accessible configured plans, subject to endpoint permission review. No group directory scan. |

Follow pagination via `@odata.nextLink` with a Graph-host/v1.0 allowlist; the current relative-path transport is intentionally insufficient for a complete list paginator. Implement request cancellation, bounded retries honouring `Retry-After`, 401/reconnect, 403/consent/access denial, 404/deleted task, and 412/conflict resolution. The prepared transport reports safe failures but does not implement a sync engine or automatic retry queue.

For Planner writes, pass the correct task/details `If-Match` ETag and refetch/reconcile on conflicts. Do not retry a stale write blindly. Preserve partial per-provider load failures in the UI instead of showing a successful empty list. Only activate advertised field capabilities after mapping, writes, error cases and tests are implemented.

## Normalization and metadata decisions

- Use UI IDs such as `todo:{listId}:{taskId}` / `planner:{taskId}`, preserving canonical IDs verbatim in dedicated fields. Route mutation by provider, not source badge: an Outlook-linked task may be a To Do record.
- Date-only UI due dates need explicit mapping to Microsoft dateTime/timezone conventions and Auckland DST tests. A due date is not a UTC midnight conversion.
- Planner progress maps to notStarted/inProgress/completed; waiting is not a native Planner status. Preserve real status and add waiting presentation only through an approved metadata strategy.
- Map native notes, checklist and linked resources where supported. Planner priority may have a richer numeric scale; define and test a deliberate lossless-enough mapping with native values retained. To Do does not natively express four distinct priority levels.
- `focusDate` is presentation metadata, not a duplicate task. Workstream grouping, waitingFor/followUpDate and a separate completion outcome are not universally supported native fields. Options include an explicitly approved Microsoft-backed extension strategy where supported, or an approved minimal preferences store keyed solely to canonical task IDs. Do not insert opaque metadata into user notes without approval, invent Graph support, or silently drop it. Disable unsupported edits until decided.
- Keep completed task notes/resources/outcomes retrievable. Never delete on completion. Decide retention policy and migration of demo data explicitly; no implicit copying to live To Do.

## Live release checks

Implement the actual providers, user connection UI and `MsalProvider` lifecycle; test incremental consent, sign-out, token expiration, canonical writes, ETag races, pagination, completion history, offline failures and tenant access. Remove the fictional profile in live mode. Keep demo and live workspaces/storage visibly separate. There is no background live write queue yet, and offline live writes must remain blocked rather than pretending to sync.

References: [To Do overview](https://learn.microsoft.com/graph/api/resources/todo-overview?view=graph-rest-1.0), [Planner overview](https://learn.microsoft.com/graph/api/resources/planner-overview?view=graph-rest-1.0), [assigned Planner tasks](https://learn.microsoft.com/graph/api/planneruser-list-tasks?view=graph-rest-1.0), [MSAL SPA authentication](https://learn.microsoft.com/entra/identity-platform/scenario-spa-overview).
