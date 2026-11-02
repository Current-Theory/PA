import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { checkHostedAccess, hasWorkHubAccess } from '../src/lib/hostedAuth';
import { hostedAssistant } from '../api/src/handler';

const approved = { userId: 'microsoft-user', identityProvider: 'aad', userRoles: ['anonymous', 'authenticated', 'workhub_user'] };
const rejected = [null, {}, { ...approved, userId: '' }, { ...approved, userId: ' ' }, { ...approved, identityProvider: 'github' }, { ...approved, identityProvider: undefined }, { ...approved, userRoles: ['authenticated'] }, { ...approved, userRoles: ['authenticated', 'work-hub-user'] }, { ...approved, userRoles: ['workhub_user'] }, { ...approved, userRoles: ['authenticated', 'workhub_user', 7] }];
afterEach(() => vi.unstubAllGlobals());

describe('hosted sign-in', () => {
  it('requires a Microsoft principal and the invited role', () => {
    expect(hasWorkHubAccess(approved)).toBe(true);
    for (const principal of rejected) expect(hasWorkHubAccess(principal)).toBe(false);
  });
  it('uses the SWA session without caching and distinguishes login from denied access', async () => {
    for (const [clientPrincipal, expected] of [[null, 'login'], [{ ...approved, userRoles: ['authenticated'] }, 'denied'], [approved, 'allowed']]) {
      const fetcher = vi.fn(async () => new Response(JSON.stringify({ clientPrincipal })));
      vi.stubGlobal('fetch', fetcher);
      expect(await checkHostedAccess()).toBe(expected);
      expect(fetcher).toHaveBeenCalledWith('/.auth/me', { cache: 'no-store', credentials: 'same-origin', redirect: 'error' });
    }
  });
  it('fails closed on a session endpoint failure', async () => {
    vi.stubGlobal('fetch', async () => new Response('unavailable', { status: 503 }));
    await expect(checkHostedAccess()).rejects.toThrow();
  });
});

describe('every managed API action', () => {
  it('rejects invalid identities before reading a body or calling OpenAI', async () => {
    const fetcher = vi.fn();
    const text = vi.fn();
    const handler = hostedAssistant({ key: 'server-only-test-key', model: 'test', origin: 'https://example.test' }, fetcher);
    for (const action of ['status', 'capture', 'chat', 'diagnostics', 'unknown']) {
      for (const principal of rejected) {
        const request = {
          method: ['status', 'diagnostics'].includes(action) ? 'GET' : 'POST', params: { action }, text,
          headers: new Headers(principal === null ? {} : { 'x-ms-client-principal': Buffer.from(JSON.stringify(principal)).toString('base64') })
        } as unknown as Parameters<typeof handler>[0];
        expect((await handler(request)).status).toBe(401);
      }
    }
    expect(text).not.toHaveBeenCalled();
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('SWA route coverage', () => {
  const config = JSON.parse(readFileSync(new URL('../public/staticwebapp.config.json', import.meta.url), 'utf8'));
  const routeFor = (path: string) => config.routes.find((rule: { route: string }) => rule.route.endsWith('*') ? path.startsWith(rule.route.slice(0, -1)) : rule.route === path);
  it('protects direct navigation, static assets and all API paths with only the custom role', () => {
    for (const path of ['/', '/index.html', '/tasks', '/projects/details', '/assets/app.js', '/manifest.webmanifest', '/api', '/api/assistant/status', '/api/assistant/capture', '/api/assistant/chat', '/api/future']) {
      expect(routeFor(path).allowedRoles, path).toEqual(['workhub_user']);
    }
    // SWA skips route rules on navigationFallback; use an authorised rewrite instead.
    expect(config.navigationFallback).toBeUndefined();
    expect(routeFor('/tasks').rewrite).toBe('/index.html');
  });
  it('leaves Microsoft callbacks, role acceptance, logout and denial assets reachable', () => {
    for (const path of ['/.auth/login/aad', '/.auth/login/aad/callback', '/.auth/complete', '/.auth/me', '/.auth/logout', '/.auth/accept', '/access-denied', '/access-denied.html', '/assistant-connected.css', '/sw.js']) {
      expect(routeFor(path).allowedRoles, path).toEqual(['anonymous']);
    }
    expect(routeFor('/.auth/login/github').statusCode).toBe(404);
    expect(config.responseOverrides['401'].redirect).toContain('/.auth/login/aad');
    expect(config.responseOverrides['403'].rewrite).toBe('/access-denied.html');
  });
  it('emits a worker with no offline fetch or precache handler', () => {
    const source = readFileSync(new URL('../build/pwa.ts', import.meta.url), 'utf8');
    expect(source).not.toContain("addEventListener('fetch'");
    expect(source).not.toContain('cache.addAll');
    expect(source).toContain('caches.delete');
  });
});
