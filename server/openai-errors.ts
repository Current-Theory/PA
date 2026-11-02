export interface SafeOpenAIResult {
  httpStatus: number | null;
  error: { type: string | null; code: string | null };
  requestId: string | null;
}

// Never expose upstream messages, bodies, account details or arbitrary headers.
export function safeErrorField(value: unknown, key: string): string | null {
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
    error: { type: safeErrorField(error?.type, key), code: safeErrorField(error?.code, key) },
    requestId: safeErrorField(response.headers.get('x-request-id'), key)
  };
}
