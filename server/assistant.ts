import type { IncomingMessage, ServerResponse } from 'node:http';
import { validateCaptureRequest } from '../src/lib/capture.ts';
import { AssistantError, generateTaskSuggestions } from './openai.ts';
import { managementReply, validateChatRequest } from './chat.ts';

export interface AssistantConfig { key?: string; model: string; allowedOrigins: string[] }
export function assistantHandler(config: AssistantConfig, fetcher: typeof fetch = fetch) {
  const requests = new Map<string, { start: number; count: number }>();
  let active = 0;
  return async (request: IncomingMessage, response: ServerResponse) => {
    const reply = (status: number, data: unknown) => {
      response.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      response.end(JSON.stringify(data));
    };
    const path = new URL(request.url ?? '/', 'http://localhost').pathname;
    if (request.headers.origin && !config.allowedOrigins.includes(request.headers.origin)) { reply(403, { error: 'This origin is not allowed to use the assistant.' }); return; }
    if (path === '/api/assistant/status' && request.method === 'GET') { reply(200, { ready: !!config.key && !!config.model }); return; }
    if (!['/api/assistant/capture', '/api/assistant/chat'].includes(path)) { reply(404, { error: 'Not found.' }); return; }
    if (request.method !== 'POST') { reply(405, { error: 'Use POST for task suggestions.' }); return; }
    if (!config.key) { reply(503, { error: 'The in-app assistant needs its secure server connection configured. Your tasks and conversation are still saved.' }); return; }
    if (!request.headers['content-type']?.startsWith('application/json')) { reply(415, { error: 'Send a JSON work note.' }); return; }
    const client = request.socket.remoteAddress ?? 'local';
    const now = Date.now();
    for (const [key, value] of requests) if (now - value.start > 60000) requests.delete(key);
    const rate = requests.get(client) ?? { start: now, count: 0 };
    if (rate.count >= (path.endsWith('/chat') ? 60 : 12) || active >= 2) { reply(429, { error: 'The assistant is busy. Wait a moment and try again.' }); return; }
    rate.count++; requests.set(client, rate);
    let size = 0;
    const chunks: Buffer[] = [];
    try {
      for await (const value of request) {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        size += chunk.length;
        if (size > (path.endsWith('/chat') ? 260000 : 64000)) { reply(413, { error: 'This request is too large. Start a new conversation; your tasks will remain.' }); return; }
        chunks.push(chunk);
      }
    } catch { reply(400, { error: 'The note could not be received. Please retry.' }); return; }
    let input;
    try { const value = JSON.parse(Buffer.concat(chunks).toString('utf8')); input = path.endsWith('/chat') ? validateChatRequest(value) : validateCaptureRequest(value); }
    catch (error) { reply(400, { error: error instanceof Error ? error.message : 'The work note is invalid.' }); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55000);
    const disconnect = () => { if (!response.writableEnded) controller.abort(); };
    response.on('close', disconnect);
    active++;
    try {
      const proposal = 'context' in input ? await managementReply(input, { key: config.key, model: config.model }, controller.signal, fetcher) : await generateTaskSuggestions(input, { key: config.key, model: config.model }, controller.signal, fetcher);
      reply(200, proposal);
    } catch (error) {
      if (!response.destroyed) reply(error instanceof AssistantError ? error.status : 502, { error: error instanceof AssistantError ? error.message : controller.signal.aborted ? 'The assistant timed out or disconnected. Confirmed actions remain saved; retry when ready.' : 'The assistant could not finish this step. Confirmed actions remain saved; retry when ready.' });
    } finally { active--; clearTimeout(timer); response.off('close', disconnect); }
  };
}
