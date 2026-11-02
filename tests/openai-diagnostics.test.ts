import { describe, expect, it, vi } from 'vitest';
import { runOpenAIDiagnostics, safeOpenAIResult } from '../server/openai-diagnostics';
import { hostedAssistant } from '../api/src/handler';
import { managementReply } from '../server/chat';

const key = 'sk-proj-private-diagnostic-test';
const model = 'configured-azure-model';
const origin = 'https://workhub.example';
const principal = Buffer.from(JSON.stringify({ userId: 'invited', identityProvider: 'aad', userRoles: ['authenticated', 'workhub_user'] })).toString('base64');
const request = (headers: Record<string, string> = {}, identity: string | null = principal) => ({
  method: 'GET', params: { action: 'diagnostics' },
  headers: new Headers({ ...(identity ? { 'x-ms-client-principal': identity } : {}), ...headers }),
  text: vi.fn(() => { throw new Error('Diagnostic must not read request content'); })
}) as unknown as Parameters<ReturnType<typeof hostedAssistant>>[0];

const upstreamFailure = () => new Response(JSON.stringify({
  error: { type: 'invalid_request_error', code: 'invalid_api_key', message: `Incorrect API key provided: ${key}`, secret: key },
  account: { secret: key }
}), { status: 401, headers: { 'x-request-id': 'req_safe123', 'x-secret': key } });

describe('temporary hosted OpenAI diagnostics', () => {
  it('probes /me first and Responses second with the exact configured credentials/model', async () => {
    const calls: string[] = [];
    const fetcher: typeof fetch = vi.fn(async (url, init) => {
      calls.push(String(url));
      expect(init?.headers).toMatchObject({ Authorization: `Bearer ${key}` });
      expect(init?.redirect).toBe('error');
      if (calls.length === 1) {
        expect(init?.method).toBe('GET');
        return upstreamFailure();
      }
      expect(init?.method).toBe('POST');
      expect(JSON.parse(String(init?.body))).toMatchObject({ model, store: false, input: 'Reply OK.', max_output_tokens: 16, tool_choice: 'auto', parallel_tool_calls: false });
      return new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'model_not_found', message: key } }), { status: 404, headers: { 'x-request-id': 'req_model' } });
    });
    const result = await hostedAssistant({ key, model, origin }, fetcher)(request());
    expect(calls).toEqual(['https://api.openai.com/v1/me', 'https://api.openai.com/v1/responses']);
    expect(result.status).toBe(200);
    expect(result.headers).toMatchObject({ 'Cache-Control': 'no-store' });
    expect(result.jsonBody).toEqual({ configuredModel: model, meAuthenticated: false,
      me: { httpStatus: 401, error: { type: 'invalid_request_error', code: 'invalid_api_key' }, requestId: 'req_safe123' },
      responses: { httpStatus: 404, error: { type: 'invalid_request_error', code: 'model_not_found' }, requestId: 'req_model' }
    });
    expect(JSON.stringify(result)).not.toContain(key);
    expect(JSON.stringify(result)).not.toContain('Incorrect API');
  });
  it('discards successful identity/account and generated response bodies', async () => {
    const result = await runOpenAIDiagnostics({ key, model }, async () => new Response(JSON.stringify({ secret: key, email: 'private@example.test', output: 'private' })));
    expect(result.meAuthenticated).toBe(true);
    expect(result.responses.httpStatus).toBe(200);
    expect(JSON.stringify(result)).not.toMatch(/secret|private@example|output/);
  });
  it('rejects missing authentication, wrong origins, missing configuration and overuse without upstream calls', async () => {
    const fetcher = vi.fn(async () => new Response('{}'));
    const handler = hostedAssistant({ key, model, origin }, fetcher);
    expect((await handler(request({}, null))).status).toBe(401);
    expect((await handler(request({ origin: 'https://evil.example' }))).status).toBe(403);
    expect((await handler(request({ 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await hostedAssistant({ model, origin }, fetcher)(request())).status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await handler(request())).status).toBe(200);
    expect((await handler(request())).status).toBe(200);
    expect((await handler(request())).status).toBe(429);
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it('does not expose exceptions, non-JSON bodies or secrets echoed into allowed fields', async () => {
    const failure = await runOpenAIDiagnostics({ key, model }, async () => { throw new Error(`Authorization: Bearer ${key}`); });
    expect(failure.me.httpStatus).toBeNull();
    expect(failure.responses.httpStatus).toBeNull();
    expect(JSON.stringify(failure)).not.toContain(key);
    const html = await safeOpenAIResult(new Response(`<html>${key}</html>`, { status: 502 }), key);
    expect(html).toEqual({ httpStatus: 502, error: { type: null, code: null }, requestId: null });
    const echoed = await safeOpenAIResult(new Response(JSON.stringify({ error: { type: key, code: key } }), { status: 401, headers: { 'x-request-id': key } }), key);
    expect(echoed.error).toEqual({ type: null, code: null });
    expect(echoed.requestId).toBeNull();
  });
  it('retains safe upstream metadata in the existing chat error without keeping its message/body', async () => {
    const input = { input: [{ role: 'user', content: 'Hi' }], context: { today: '2026-11-02', timezone: 'Pacific/Auckland', workstream: 'Projects', workstreams: ['Projects'], recentTasks: [], recentProjects: [] } };
    await expect(managementReply(input, { key, model }, new AbortController().signal, async () => upstreamFailure())).rejects.toMatchObject({
      status: 502, openai: { httpStatus: 401, error: { type: 'invalid_request_error', code: 'invalid_api_key' }, requestId: 'req_safe123' }
    });
  });
});
