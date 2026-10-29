import { captureInstructions, captureSchema, parseTaskSuggestions, type CaptureRequest } from '../src/lib/capture.ts';

export class AssistantError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) { super(message); this.status = status; }
}
export interface OpenAIConfig { key: string; model: string }

export async function generateTaskSuggestions(input: CaptureRequest, config: OpenAIConfig, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const result = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.key}` },
    signal,
    body: JSON.stringify({ model: config.model, store: false, instructions: captureInstructions,
      input: JSON.stringify(input), max_output_tokens: 8000,
      text: { format: { type: 'json_schema', name: 'work_hub_capture', strict: true, schema: captureSchema } }
    })
  });
  if (!result.ok) {
    const message = result.status === 429 ? 'The OpenAI API is rate limited or has no available quota. Check the server’s billing and try again later.'
      : result.status === 401 || result.status === 403 ? 'The server’s OpenAI API access was rejected. Check its key and permissions.'
      : 'The OpenAI service could not complete the request. Your note is still here.';
    throw new AssistantError(message, result.status === 429 ? 429 : 502);
  }
  const raw = await result.text();
  if (raw.length > 300000) throw new Error('oversized response');
  const data = JSON.parse(raw) as { status?: string; output?: { content?: { type?: string; text?: string }[] }[] };
  if (data.status !== 'completed') throw new Error('incomplete response');
  const text = data.output?.flatMap(item => item.content ?? []).filter(item => item.type === 'output_text').map(item => item.text ?? '').join('');
  return parseTaskSuggestions(text, input.workstreams, input.workstream);
}
