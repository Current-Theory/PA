import { describe, it, expect } from 'vitest';
import { approvedPrincipal, hostedAssistant } from '../api/src/handler';

const origin = 'https://work-hub.example';
const input = { note: 'Review the package requested by Victoria', workstream: 'Projects', workstreams: ['Projects'], today: '2026-10-30' };
const proposal = { summary: 'Review the package.', tasks: [{ title: 'Review the package', workstream: 'Projects', notes: 'Requested by Victoria.', status: 'notStarted', priority: 'normal', dueDate: null, waitingFor: '', followUpDate: null, checklist: [], focusToday: true }] };
type Request = Parameters<ReturnType<typeof hostedAssistant>>[0];
const principal = (userId = 'approved-user', userRoles = ['anonymous', 'authenticated', 'workhub_user']) => Buffer.from(JSON.stringify({ userId, userRoles, identityProvider: 'aad' })).toString('base64');
const request = (options: { identity?: string | null; action?: string; method?: string; from?: string; body?: unknown } = {}): Request => ({
  headers: new Headers({ 'content-type': 'application/json', origin: options.from ?? origin, ...(options.identity === null ? {} : { 'x-ms-client-principal': options.identity ?? principal() }) }),
  params: { action: options.action ?? 'capture' }, method: options.method ?? 'POST',
  text: async () => JSON.stringify(options.body ?? input)
}) as unknown as Request;
const response = () => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(proposal) }] }] }));

describe('managed Azure API authorisation', () => {
  it('serves the same function-calling contract through the protected hosted chat route', async () => {
    const handler = hostedAssistant({ key: 'server-key', model: 'configured-model', origin }, async () => new Response(JSON.stringify({ status: 'completed', output: [{ type: 'function_call', call_id: 'today-1', name: 'get_today_tasks', arguments: '{}' }] })));
    const body = { input: [{ role: 'user', content: 'What should I do today?' }], context: { today: '2026-10-30', timezone: 'Pacific/Auckland', workstream: 'Projects', workstreams: ['Projects'], recentTasks: [], recentProjects: [] } };
    const result = await handler(request({ action: 'chat', body }));
    expect(result.status).toBe(200); expect(result.jsonBody).toMatchObject({ calls: [{ name: 'get_today_tasks' }] });
  });
  it('requires both authenticated and explicitly approved roles', async () => {
    const handler = hostedAssistant({ key: 'server-key', model: 'configured-model', origin }, async () => { throw new Error('must not call OpenAI'); });
    for (const identity of [null, 'invalid', principal('user', ['authenticated']), principal('user', ['workhub_user'])]) {
      expect((await handler(request({ identity }))).status).toBe(401);
    }
    expect(approvedPrincipal(principal())?.userId).toBe('approved-user');
  });
  it('returns suggestions only for an approved user and app origin', async () => {
    const handler = hostedAssistant({ key: 'server-key', model: 'configured-model', origin }, async () => response());
    const result = await handler(request());
    expect(result.status).toBe(200);
    expect(result.jsonBody).toMatchObject({ tasks: [{ title: 'Review the package' }] });
    expect(JSON.stringify(result)).not.toContain('server-key');
    expect((await handler(request({ from: 'https://other.example' }))).status).toBe(403);
  });
  it('fails closed when server configuration or capture context is incomplete', async () => {
    const missing = hostedAssistant({ model: 'configured-model', origin });
    expect((await missing(request({ action: 'status', method: 'GET' }))).jsonBody).toEqual({ ready: false });
    expect((await missing(request())).status).toBe(503);
    const configured = hostedAssistant({ key: 'server-key', model: 'configured-model', origin });
    expect((await configured(request({ body: { ...input, today: '2026-02-30' } }))).status).toBe(400);
  });
  it('applies request limits per approved identity rather than trusting forwarded client addresses', async () => {
    let calls = 0;
    const handler = hostedAssistant({ key: 'server-key', model: 'configured-model', origin }, async () => { calls++; return response(); });
    for (let index = 0; index < 12; index++) expect((await handler(request())).status).toBe(200);
    expect((await handler(request())).status).toBe(429);
    expect((await handler(request({ identity: principal('second-approved-user') }))).status).toBe(200);
    expect(calls).toBe(13);
  });
});
