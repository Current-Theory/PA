import { test, expect } from '@playwright/test';

test('invited Microsoft user can open the workspace', async ({ page }) => {
  await page.route('**/.auth/me', route => route.fulfill({ json: { clientPrincipal: { userId: 'approved', identityProvider: 'aad', userRoles: ['authenticated', 'workhub_user'] } } }));
  await page.goto('/#today');
  await expect(page.getByRole('heading', { name: "Today's focus" })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Sign out of Work Hub' })).toHaveAttribute('href', '/.auth/logout?post_logout_redirect_uri=/access-denied');
});

test('signed-in users without permission go to access denied without loading the app', async ({ page }) => {
  const appRequests: string[] = [];
  page.on('request', request => { if (/\/assets\/App-/.test(request.url())) appRequests.push(request.url()); });
  await page.route('**/.auth/me', route => route.fulfill({ json: { clientPrincipal: { userId: 'uninvited', identityProvider: 'aad', userRoles: ['authenticated'] } } }));
  // Preview serves the HTML file directly; the real /access-denied rewrite is a gateway rule.
  await page.route('**/access-denied', route => route.fulfill({ status: 403, contentType: 'text/html', body: '<h1>Access denied</h1>' }));
  await page.goto('/');
  await expect(page).toHaveURL(/\/access-denied$/);
  await expect(page.getByRole('heading', { name: 'Access denied' })).toBeVisible();
  expect(appRequests).toEqual([]);
});

test('anonymous users are sent to Microsoft sign-in', async ({ page }) => {
  await page.route('**/.auth/me', route => route.fulfill({ json: { clientPrincipal: null } }));
  await page.route('**/.auth/login/aad?*', route => route.fulfill({ contentType: 'text/html', body: '<h1>Microsoft sign-in</h1>' }));
  await page.goto('/');
  await expect(page).toHaveURL(/\/\.auth\/login\/aad\?/);
});

test('session service failure leaves the workspace locked', async ({ page }) => {
  await page.route('**/.auth/me', route => route.fulfill({ status: 503 }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Sign-in check unavailable' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Quick capture task' })).toHaveCount(0);
});
