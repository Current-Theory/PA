import { PublicClientApplication, InteractionRequiredAuthError, type AccountInfo } from '@azure/msal-browser';

export const graphScopes = {
  read: ['Tasks.Read'],
  write: ['Tasks.ReadWrite']
} as const;

export function microsoftConfiguration() {
  const clientId = import.meta.env.VITE_ENTRA_CLIENT_ID?.trim();
  const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID?.trim();
  const redirectUri = import.meta.env.VITE_ENTRA_REDIRECT_URI?.trim();
  const guid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
  if (!clientId || !tenantId || !redirectUri || !guid.test(clientId) || !guid.test(tenantId)) return null;
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) return null;
  } catch { return null; }
  return { clientId, tenantId, redirectUri };
}

// Invoked only by a future explicit live-mode connection flow, never by demo startup.
export async function createMicrosoftClient(): Promise<PublicClientApplication> {
  const config = microsoftConfiguration();
  if (!config) throw new Error('Valid Entra client ID, tenant ID and SPA redirect URI are required.');
  const client = new PublicClientApplication({
    auth: { clientId: config.clientId, authority: `https://login.microsoftonline.com/${config.tenantId}`, redirectUri: config.redirectUri },
    cache: { cacheLocation: 'memoryStorage' }
  });
  await client.initialize();
  return client;
}

export class GraphClient {
  constructor(private auth: PublicClientApplication, private account: AccountInfo) {}
  async request<T>(path: string, init: RequestInit = {}, scopes: readonly string[] = graphScopes.read): Promise<T> {
    if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) throw new Error('Use a relative Graph v1.0 path.');
    let token;
    try { token = await this.auth.acquireTokenSilent({ account: this.account, scopes: [...scopes] }); }
    catch (error) {
      if (error instanceof InteractionRequiredAuthError) throw new Error('Microsoft requires you to reconnect before continuing.');
      throw new Error('Microsoft authentication failed. Reconnect and retry.');
    }
    const headers = new Headers(init.headers);
    headers.set('Authorization', `Bearer ${token.accessToken}`);
    headers.set('Content-Type', 'application/json');
    const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers, cache: 'no-store' });
    if (!response.ok) {
      // Never include tokens, task content or raw Graph bodies in errors/logs.
      if (response.status === 412) throw new Error('This task changed in Microsoft 365. Refresh before saving again.');
      if (response.status === 429) throw new Error(`Microsoft is busy. Retry after ${response.headers.get('Retry-After') ?? 'a few'} seconds.`);
      throw new Error(`Microsoft Graph request failed (${response.status}).`);
    }
    if (response.status === 204) return undefined as T;
    return response.json() as Promise<T>;
  }
}
