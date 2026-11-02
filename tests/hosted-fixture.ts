import { test as base, expect } from '@playwright/test';
export type { Page } from '@playwright/test';

// Workflow tests run as an invited Microsoft user. Dedicated auth tests exercise
// missing/denied sessions separately; Vite preview does not emulate SWA's gateway.
export const test = base.extend({
  page: async ({ page }, providePage) => {
    await page.route('**/.auth/me', route => route.fulfill({ json: { clientPrincipal: {
      userId: 'invited-test-user', identityProvider: 'aad', userRoles: ['anonymous', 'authenticated', 'workhub_user']
    } } }));
    await providePage(page);
  }
});
export { expect };
