# Temporary hosted AI diagnostics

After manually redeploying main, sign in to the hosted Work Hub as an invited Microsoft user with `workhub_user`. In the same browser, open:

`https://<your-existing-Azure-hostname>/api/assistant/diagnostics`

No key or query parameters are needed. The API uses the server's existing `WORK_HUB_AI_KEY` and `WORK_HUB_AI_MODEL` (retaining the existing `gpt-5-mini` fallback when no model setting exists). It does not change Azure settings. Gateway and handler principal/provider/role checks protect the endpoint. It returns JSON with only:

- `configuredModel`
- `meAuthenticated`
- `me` and `responses`: each has `httpStatus`, `error.type`, `error.code`, `requestId`

It first calls OpenAI `GET /v1/me`, then calls `POST /v1/responses` with the configured model, existing assistant tool definitions, `store: false`, a fixed tiny input and a 16-token output cap. It submits no user/workspace data and never executes returned tools. The Responses call can incur a small OpenAI API charge. Diagnostic success means the Responses HTTP request was accepted, not that a full assistant/tool conversation was validated; a tiny output cap can yield an incomplete response.

A 2xx `me.httpStatus` sets `meAuthenticated: true`. A non-2xx /me result should be interpreted alongside its safe fields and the Responses result; it alone does not establish that the key is invalid. `null` HTTP status means the probe could not obtain a response (for example, network failure or timeout). Missing/unsafe upstream fields are null. Request IDs come from OpenAI's `x-request-id` header. No response messages/bodies, identity account data, headers, key, environment dump or raw exceptions are returned or logged.

The browser response is `no-store`. Each probe has a 12-second timeout, redirects are rejected, and existing instance-local throttling/concurrency limits apply (at most two diagnostic requests per user per minute). Cross-site requests are rejected. Normal browser navigation needs no Origin header. A missing key yields the existing safe 503 configuration error; missing app origin yields 403 before any probe.

Share only the resulting diagnostic JSON to investigate the failure. Existing capture/chat errors also retain allowlisted upstream metadata internally in `AssistantError.openai`; raw upstream messages remain discarded. Remove this temporary endpoint, helper and dedicated tests after diagnosis. No deployment workflow, secret, model setting, authentication configuration or Azure resource is changed by this implementation.
