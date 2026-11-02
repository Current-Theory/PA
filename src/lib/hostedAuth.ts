// SWA's session endpoint is the source of identity; this is a UI gate only.
// The managed gateway and API handler independently enforce access.
export function hasWorkHubAccess(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const principal = value as Record<string, unknown>;
  return principal.identityProvider === 'aad'
    && typeof principal.userId === 'string' && !!principal.userId.trim()
    && Array.isArray(principal.userRoles)
    && principal.userRoles.every(role => typeof role === 'string')
    && principal.userRoles.includes('authenticated')
    && principal.userRoles.includes('workhub_user');
}

export async function checkHostedAccess(): Promise<'allowed' | 'login' | 'denied'> {
  const response = await fetch('/.auth/me', { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
  if (!response.ok) throw new Error('Unable to check Microsoft sign-in. Reload to retry.');
  const { clientPrincipal } = await response.json();
  return !clientPrincipal ? 'login' : hasWorkHubAccess(clientPrincipal) ? 'allowed' : 'denied';
}
