import { describe, expect, it } from 'vitest';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { assistantHandler } from '../server/assistant';

const input = { note: 'Victoria requested quality assurance of the new package', workstream: 'Projects', workstreams: ['Projects'], today: '2026-10-30' };
const proposal = { summary: 'Review the new package.', tasks: [{ title: 'Review the new package', notes: 'Victoria requested quality assurance.', workstream: 'Projects', status: 'notStarted', priority: 'normal', dueDate: null, waitingFor: '', followUpDate: null, checklist: ['Review the package'], focusToday: true }] };
const success = () => new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(proposal) }] }] }), { status: 200 });

async function invoke(handler: ReturnType<typeof assistantHandler>, body: unknown = input, options: { path?: string; method?: string; origin?: string } = {}) {
  const request = Object.assign(Readable.from([Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))]), {
    method: options.method ?? 'POST', url: options.path ?? '/api/assistant/capture',
    headers: { 'content-type': 'application/json', origin: options.origin ?? 'http://localhost:5173' },
    socket: { remoteAddress: '127.0.0.1' }
  }) as unknown as IncomingMessage;
  const response = Object.assign(new EventEmitter(), {
    destroyed: false, writableEnded: false, status: 0, body: '',
    writeHead(status: number) { this.status = status; },
    end(value: string) { this.body = value; this.writableEnded = true; }
  });
  await handler(request, response as unknown as ServerResponse);
  return { status: response.status, data: JSON.parse(response.body) };
}

describe('server-side assistant boundary', () => {
  it('sends a structured Responses request with no client secret exposure or provider writes', async () => {
    let url = '', payload: Record<string, unknown> = {};
    const handler = assistantHandler({ key: 'server-test-key', model: 'configured-model', allowedOrigins: ['http://localhost:5173'] }, async (target, init) => {
      url = String(target); payload = JSON.parse(init?.body as string);
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer server-test-key');
      return success();
    });
    const result = await invoke(handler);
    expect(result.status).toBe(200);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(payload).toMatchObject({ model: 'configured-model', store: false, text: { format: { type: 'json_schema', strict: true } } });
    expect(JSON.stringify(result.data)).not.toContain('server-test-key');
    expect(result.data.tasks[0].title).toBe('Review the new package');
  });
  it('refuses requests without a key and reports status without returning credentials', async () => {
    const handler = assistantHandler({ model: 'configured-model', allowedOrigins: ['http://localhost:5173'] }, async () => { throw new Error('must not fetch'); });
    expect((await invoke(handler)).status).toBe(503);
    expect((await invoke(handler, {}, { method: 'GET', path: '/api/assistant/status' })).data).toEqual({ ready: false });
  });
  it('rejects other origins and invalid/oversized notes before contacting OpenAI', async () => {
    let calls = 0;
    const handler = assistantHandler({ key: 'test-key', model: 'configured-model', allowedOrigins: ['http://localhost:5173'] }, async () => { calls++; return success(); });
    expect((await invoke(handler, input, { origin: 'https://unrelated.example' })).status).toBe(403);
    expect((await invoke(handler, { ...input, today: 'not-a-date' })).status).toBe(400);
    expect((await invoke(handler, 'x'.repeat(65000))).status).toBe(413);
    expect(calls).toBe(0);
  });
  it('treats refusals, malformed model replies and incomplete generation as errors, not saved tasks', async () => {
    for (const response of [new Response(JSON.stringify({ status: 'incomplete', output: [] })), new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'refusal' }] }] })), new Response('sensitive upstream body', { status: 401 })]) {
      const handler = assistantHandler({ key: 'test-key', model: 'configured-model', allowedOrigins: ['http://localhost:5173'] }, async () => response);
      const result = await invoke(handler);
      expect(result.status).toBe(502);
      expect(JSON.stringify(result.data)).not.toContain('sensitive upstream body');
    }
  });
  it('limits repeated requests without forwarding an unlimited stream to OpenAI', async () => {
    let calls = 0;
    const handler = assistantHandler({ key: 'test-key', model: 'configured-model', allowedOrigins: ['http://localhost:5173'] }, async () => { calls++; return success(); });
    for (let index = 0; index < 12; index++) expect((await invoke(handler)).status).toBe(200);
    expect((await invoke(handler)).status).toBe(429);
    expect(calls).toBe(12);
  });
});
