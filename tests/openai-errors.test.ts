import { describe, expect, it } from 'vitest';
import { safeOpenAIResult } from '../server/openai-errors';
import { managementReply } from '../server/chat';

const key = 'sk-proj-private-test';
describe('safe OpenAI error handling', () => {
  it('keeps allowed metadata and discards upstream messages and secret headers', async () => {
    const result = await safeOpenAIResult(new Response(JSON.stringify({ error: {
      type: 'invalid_request_error', code: 'invalid_api_key', message: `Incorrect API key: ${key}`
    } }), { status: 401, headers: { 'x-request-id': 'req_safe123', 'x-secret': key } }), key);
    expect(result).toEqual({ httpStatus: 401, error: { type: 'invalid_request_error', code: 'invalid_api_key' }, requestId: 'req_safe123' });
    expect(JSON.stringify(result)).not.toContain(key);
  });
  it('redacts secrets echoed into metadata and tolerates non-JSON errors', async () => {
    const echoed = await safeOpenAIResult(new Response(JSON.stringify({ error: { type: key, code: key } }), { status: 401, headers: { 'x-request-id': key } }), key);
    expect(echoed).toEqual({ httpStatus: 401, error: { type: null, code: null }, requestId: null });
    const html = await safeOpenAIResult(new Response(`<html>${key}</html>`, { status: 502 }), key);
    expect(html).toEqual({ httpStatus: 502, error: { type: null, code: null }, requestId: null });
  });
  it('preserves safe metadata on normal chat failures', async () => {
    const input = { input: [{ role: 'user', content: 'Hi' }], context: { today: '2026-11-02', timezone: 'Pacific/Auckland', workstream: 'Projects', workstreams: ['Projects'], recentTasks: [], recentProjects: [] } };
    await expect(managementReply(input, { key, model: 'configured-model' }, new AbortController().signal, async () => new Response(JSON.stringify({ error: { type: 'invalid_request_error', code: 'invalid_api_key', message: key } }), { status: 401, headers: { 'x-request-id': 'req_safe123' } }))).rejects.toMatchObject({
      status: 502, openai: { httpStatus: 401, error: { type: 'invalid_request_error', code: 'invalid_api_key' }, requestId: 'req_safe123' }
    });
  });
});
