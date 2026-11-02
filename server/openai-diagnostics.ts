import { functionTools } from '../src/assistant/tools.ts';

export interface SafeOpenAIResult {
  httpStatus: number | null;
  error: { type: string | null; code: string | null };
  requestId: string | null;
}

// Never expose upstream messages, bodies, account details or arbitrary headers.
export function safeDiagnosticField(value: unknown, key: string): string | null {
  return typeof value === 'string' && value.length <= 200
    && /^[A-Za-z0-9_.:/-]+$/.test(value)
    && !value.includes(key) && !/sk-/i.test(value) ? value : null;
}

export async function safeOpenAIResult(response: Response, key: string): Promise<SafeOpenAIResult> {
  let error: { type?: unknown; code?: unknown } | undefined;
  if (!response.ok) {
    try {
      const body = await response.json();
      error = body?.error;
    } catch { /* Non-JSON gateway errors have no safe structured fields. */ }
  }
  return {
    httpStatus: response.status,
    error: { type: safeDiagnosticField(error?.type, key), code: safeDiagnosticField(error?.code, key) },
    requestId: safeDiagnosticField(response.headers.get('x-request-id'), key)
  };
}

export async function runOpenAIDiagnostics(config: { key: string; model: string }, fetcher: typeof fetch = fetch) {
  const probe = async (path: string, body?: unknown): Promise<SafeOpenAIResult> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetcher(`https://api.openai.com/v1/${path}`, {
        method: body === undefined ? 'GET' : 'POST', redirect: 'error', signal: controller.signal,
        headers: { Authorization: `Bearer ${config.key}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      return await safeOpenAIResult(response, config.key);
    } catch {
      // Fetch errors may contain credentials or headers. Never serialize/log them.
      return { httpStatus: null, error: { type: null, code: null }, requestId: null };
    } finally { clearTimeout(timer); }
  };
  // Sequential, even if /me fails: compare identity access with Responses access.
  const me = await probe('me');
  const responses = await probe('responses', {
    model: config.model, store: false, input: 'Reply OK.', max_output_tokens: 16,
    tools: functionTools, tool_choice: 'auto', parallel_tool_calls: false
  });
  return {
    configuredModel: safeDiagnosticField(config.model, config.key),
    meAuthenticated: me.httpStatus !== null && me.httpStatus >= 200 && me.httpStatus < 300,
    me, responses
  };
}
