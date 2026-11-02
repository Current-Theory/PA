# Temporary Conversation attachments — local review

Implemented locally. Nothing committed, pushed or deployed. Azure configuration, Microsoft authentication, invited-role rules, credentials, model settings and deployment workflows are unchanged. No new Azure service or dependency is required.

## Model and API verification

The user confirmed the deployed model setting is `gpt-5-mini` before implementation. Its official model documentation lists text/image input and Responses support. Current Responses documentation supports the requested document formats. Files API expiry supports a one-hour minimum. Image file references use the documented `input_image` mechanism with a vision-purpose upload.

Primary references checked during implementation:

- [GPT-5 mini model](https://developers.openai.com/api/docs/models/gpt-5-mini)
- [Responses file inputs and format limitations](https://developers.openai.com/api/docs/guides/file-inputs)
- [Files creation and expires_after](https://developers.openai.com/api/reference/resources/files/methods/create)
- [Images and vision](https://developers.openai.com/api/docs/guides/images-vision)
- [Azure Static Web Apps quotas](https://learn.microsoft.com/en-us/azure/static-web-apps/quotas)

The application accepts PDF, DOCX, XLSX, PPTX, UTF-8 TXT/CSV and PNG/JPEG. Non-PDF document input exposes text, not embedded charts/images. Spreadsheet processing can cover only the first 1,000 rows per sheet and augmented summaries. Instructions tell the model to disclose omissions rather than imply a complete visual/full-sheet review. Use a PDF when embedded visuals matter. Other configured models remain usable for ordinary chat, but this first version enables attachments only for the verified GPT-5 mini family; it never switches the model.

## User flow

The composer has a paperclip, compact filename/type/size chips and removal buttons. Selection/drop never sends or uploads a file. Explicit Send uploads the selected batch first, then sends the normal text message with opaque temporary references. Dictation finalises before upload. Attachment-only automatic submissions are not introduced; the user supplies a question/action.

The same selected files and typed message remain available after upload or analysis failure. An initial failed analysis restores the previous conversation rather than leaving a misleading exchange or blocking a retry. If tools already completed actions before a later failure, those records/checkpoints are retained and the existing Resume/Stop recovery remains available. Removing a selected chip does not create any storage or network request.

## Backend and security

- `POST /api/assistant/attachments` is served by the existing managed function route. Both the SWA `/api/*` rule and handler principal checks apply, including Microsoft `aad`, nonempty user ID, `authenticated` and `workhub_user`. Origin, server key, per-user rate and concurrency checks run before body processing/upstream calls.
- Uploads use multipart form data, separately from the size-limited JSON chat endpoint. A counted reader bounds the entire multipart body to 20 MiB plus small framing overhead. Application limits are 10 MiB per file, 3 files per message and 20 MiB combined, enforced client and server. This stays below SWA Free's documented 30 MB request limit.
- Filename/extension/MIME/size checks and byte inspection precede any upstream upload. Generic OS MIME values are accepted only with matching supported extension and content inspection. PDF/image signatures, UTF-8 text checks and Office ZIP structures are checked. Active HTML/SVG extensions and mismatched/binary text are rejected. Macro/ActiveX/encrypted or overly complex Office containers are rejected; archive limits are 2,000 entries, 40 MiB declared expansion and 128 KiB type-manifest inflation. No uploaded content is rendered as HTML, SVG or an image preview.
- Documents upload to OpenAI Files with `purpose: user_data`; images use `purpose: vision`. Both specify `expires_after[anchor]=created_at` and `expires_after[seconds]=3600`. The returned expiry and byte count must be confirmed. Partial batches or missing expiry trigger best-effort immediate deletion; upload requests never omit expiry.
- References are authenticated-encrypted with a key derived from the existing server-only OpenAI key, scoped to the current Microsoft user and expiry. No new secret or server database is needed. References work across managed-function instances but not across users, after expiry, or after key rotation. OpenAI IDs are neither displayed nor returned by upload; file-citation IDs are removed from model output metadata.
- The server turns validated references into `input_file` or `input_image` content parts. Client-supplied raw file IDs, file data and file/image URLs in chat input are rejected. The browser never sends large base64 files in chat JSON or receives the API key.
- Existing Responses tools, management instructions, model selection, `store: false`, timeout and action receipt/checkpoint handling remain. Files/names are untrusted data, and instructions forbid embedded directives from authorising workspace writes. Normal records may be created/updated only at the user's request; a document is not silently copied into task/project notes.

## Retention and follow-ups

Raw files exist only in the selected browser state and transient upload buffers; they are never written to IndexedDB, disk, Blob Storage, vector stores or a library. After success the composer releases its file references. OpenAI originals expire after one hour from upload; they can be removed earlier on failed batches.

For immediate follow-ups the engine retains the latest successful attachment batch in memory only. New attachments replace that active source batch; attach all files to compare together in one message. The same references are sent on tool continuation steps without reuploading. Refresh/reopening loses this in-memory context. Expired/missing context is explicitly flagged to the server/model so source-dependent questions request reattachment instead of claiming access to an old original. An interrupted turn requiring lost files tells the user to stop the request and attach again, preserving completed actions.

Only filenames/types/sizes are retained as normal conversation metadata. Conversation answers and explicitly requested normal task/project records retain their usual persistence. This does not promise that a generated summary vanishes when its original expires. Workspace backups still exclude conversation state and contain no raw attachments or tokens.

The attachment control is enabled by the authenticated hosted status capability. The loopback adapter and portable HTML do not provide a file-upload backend. No new cloud storage, OCR service, indexing, file_search or Assistants API integration was added. No file contents, request Authorization headers or secret values are logged by this implementation.

## Verification

- Lint, TypeScript, 72 unit tests across 12 files, frontend build, managed API build and portable build passed.
- Browser suite: 55 passed, 1 skipped. The managed environment blocks direct portable file URLs; equivalent offline packaged-HTML tests passed. Existing workflow/accessibility tests remain and were not weakened.
- Coverage includes attach/remove without upload, PDF/Office container/image validation, text plus files, multiple attachments, client/server limits, unauthenticated/wrong-provider/wrong-role/wrong-origin rejection, malicious MIME/content, model/expiry rejection, owner binding, failed batch cleanup, upload/body timeout, safe processing failure, immediate/reloaded/expired follow-ups, tool actions with attachments, action recovery, responsive chips, and no binary files/tokens in IndexedDB.
- Production browser assets were scanned for the server key variable, project-key patterns and server encryption helper; no matches. No live OpenAI file upload or model call was made, and no Azure resource was deployed. Actual hosted upload/analysis and expiry should be smoke-tested after a separately authorised deployment.

[390px composer screenshot](screenshots/attachments-mobile.png)
