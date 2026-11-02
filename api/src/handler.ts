import { runOpenAIDiagnostics } from '../../server/openai-diagnostics.ts';
import type { HttpRequest, HttpResponseInit } from '@azure/functions';
import { validateCaptureRequest } from '../../src/lib/capture.ts';
import { AssistantError, generateTaskSuggestions } from '../../server/openai.ts';
import { managementReply, validateChatRequest } from '../../server/chat.ts';

interface HostedConfig { key?: string; model: string; origin?: string }
interface Principal { userId: string; identityProvider: 'aad'; userRoles: string[] }

// Trust this header ONLY behind the Azure Static Web Apps managed API gateway,
// which validates authentication and strips user-supplied reserved headers.
export function approvedPrincipal(header: string | null): Principal | null {
  try {
    if (!header || header.length > 16000 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(header)) return null;
    const value = JSON.parse(Buffer.from(header, 'base64').toString('utf8'));
    if (!value || typeof value !== 'object' || value.identityProvider !== 'aad' || typeof value.userId !== 'string' || !value.userId.trim() || !Array.isArray(value.userRoles) || !value.userRoles.every((role: unknown) => typeof role === 'string') || !value.userRoles.includes('authenticated') || !value.userRoles.includes('workhub_user')) return null;
    return { userId: value.userId, identityProvider: 'aad', userRoles: value.userRoles };
  } catch { return null; }
}

export function hostedAssistant(config: HostedConfig, fetcher: typeof fetch = fetch) {
  const rates = new Map<string, { start: number; count: number }>();
  let active = 0;
  return async (request: HttpRequest): Promise<HttpResponseInit> => {
    const reply = (status: number, jsonBody: unknown): HttpResponseInit => ({ status, jsonBody, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
    const principal = approvedPrincipal(request.headers.get('x-ms-client-principal'));
    if (!principal) return reply(401, { error: 'Sign in with an approved Work Hub account to use the assistant.' });
    const action = request.params.action;
    if (action === 'status' && request.method === 'GET') return reply(200, { ready: !!config.key && !!config.origin });
    const diagnostic = action === 'diagnostics' && request.method === 'GET';
    if (!diagnostic && (!['capture', 'chat'].includes(action) || request.method !== 'POST')) return reply(404, { error: 'Not found.' });
    if (!config.origin || (diagnostic
      ? (request.headers.has('origin') && request.headers.get('origin') !== config.origin) || request.headers.get('sec-fetch-site') === 'cross-site'
      : request.headers.get('origin') !== config.origin)) return reply(403, { error: 'This origin is not approved for assisted capture.' });
    if (!config.key) return reply(503, { error: 'The hosted assistant has no server-side API key configured.' });
    if (!diagnostic && !request.headers.get('content-type')?.startsWith('application/json')) return reply(415, { error: 'Send a JSON work note.' });
    const now = Date.now();
    for (const [user, rate] of rates) if (now - rate.start > 60000) rates.delete(user);
    const rate = rates.get(principal.userId) ?? { start: now, count: 0 };
    if (rate.count >= (diagnostic ? 2 : action === 'chat' ? 60 : 12) || active >= 2) return reply(429, { error: 'The assistant is busy. Wait a moment and try again.' });
    rate.count++; rates.set(principal.userId, rate);
    if (diagnostic) {
      active++;
      try { return reply(200, await runOpenAIDiagnostics({ key: config.key, model: config.model }, fetcher)); }
      finally { active--; }
    }
    let input;
    try {
      const text = await request.text();
      if (Buffer.byteLength(text) > (action === 'chat' ? 260000 : 64000)) return reply(413, { error: 'This request is too large.' });
      input = action === 'chat' ? validateChatRequest(JSON.parse(text)) : validateCaptureRequest(JSON.parse(text));
    } catch { return reply(400, { error: 'Provide a valid work note, workstream and calendar date.' }); }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    active++;
    try { return reply(200, 'context' in input ? await managementReply(input, { key: config.key, model: config.model }, controller.signal, fetcher) : await generateTaskSuggestions(input, { key: config.key, model: config.model }, controller.signal, fetcher)); }
    catch (error) { return reply(error instanceof AssistantError ? error.status : 502, { error: error instanceof AssistantError ? error.message : 'The assistant could not produce valid suggestions. Your note is still here; retry when ready.' }); }
    finally { active--; clearTimeout(timer); }
  };
}
