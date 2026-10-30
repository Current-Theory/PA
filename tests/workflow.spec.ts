import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

test.beforeEach(async ({ page }) => {
  await page.goto('/#today');
  await expect(page.getByRole('heading', { name: 'Focus Today' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Getting your workspace ready' })).toHaveCount(0);
});

test('capture, edit, checklist, outcome, completion history and persistence', async ({ page }) => {
  const capture = page.getByRole('textbox', { name: 'Quick capture task' });
  await capture.fill('Prepare pilot release'); await capture.press('Enter');
  await page.getByRole('button', { name: 'Open Prepare pilot release', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'TASK DETAILS' });
  await dialog.getByLabel('Task notes', { exact: true }).fill('Keep this context for the pilot review.');
  await dialog.getByLabel('New checklist item', { exact: true }).fill('Send review pack');
  await dialog.getByLabel('New checklist item', { exact: true }).press('Enter');
  await dialog.getByRole('checkbox', { name: 'Send review pack' }).check();
  await dialog.getByLabel('Completion note', { exact: true }).fill('Pilot approved and pack shared.');
  await dialog.getByLabel('Resource title', { exact: true }).fill('Reference');
  await dialog.getByLabel('Resource URL', { exact: true }).fill('https://example.com/reference');
  await dialog.getByRole('button', { name: 'Add resource', exact: true }).click();
  await dialog.getByRole('button', { name: 'Complete task', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await page.getByRole('link', { name: /^Completed/ }).click();
  await page.getByLabel('Search tasks', { exact: true }).fill('Pilot approved');
  await expect(page.getByRole('button', { name: 'Open Prepare pilot release', exact: true })).toBeVisible();
  await page.reload();
  await page.getByLabel('Search tasks', { exact: true }).fill('Pilot approved');
  await page.getByRole('button', { name: 'Open Prepare pilot release', exact: true }).click();
  await expect(dialog.getByLabel('Task notes', { exact: true })).toHaveValue('Keep this context for the pilot review.');
  await expect(dialog.getByRole('checkbox', { name: 'Send review pack' })).toBeChecked();
  await expect(dialog.getByRole('link', { name: 'Reference', exact: true })).toHaveAttribute('href', 'https://example.com/reference');
  await dialog.getByLabel('Status', { exact: true }).selectOption('inProgress');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByRole('button', { name: 'Open Prepare pilot release', exact: true })).toHaveCount(0);
});

test('waiting and follow-up, filtering and configurable workstreams', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Status', { exact: true }).selectOption('waiting');
  await dialog.getByLabel('Waiting on', { exact: true }).fill('Content review team');
  await dialog.getByLabel('Follow-up date', { exact: true }).fill('2020-01-01');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Content review team · Follow up today')).toBeVisible();
  await page.getByRole('link', { name: /^Waiting/ }).click();
  await expect(page.getByText('Content review team', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Workstreams', exact: true }).click();
  await page.getByLabel('New workstream name', { exact: true }).fill('Pilot delivery');
  await page.getByRole('button', { name: 'Add workstream', exact: true }).click();
  const card = page.getByRole('article').filter({ has: page.getByRole('heading', { name: 'Pilot delivery', exact: true }) });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: 'View tasks' }).click();
  await expect(page.getByLabel('Filter workstream', { exact: true })).toHaveValue('Pilot delivery');
  await expect(page.getByRole('heading', { name: 'No tasks found' })).toBeVisible();
});

test('completion has undo and preserves canonical record', async ({ page }) => {
  await page.getByRole('checkbox', { name: 'Complete Review Year 3 assessment wording', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true })).toHaveCount(1);
});

test('keyboard drawer focus, safe links and non-visual accessibility', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Task title', { exact: true })).toBeFocused();
  await dialog.getByLabel('Resource URL', { exact: true }).fill('javascript:alert(1)');
  await dialog.getByRole('button', { name: 'Add resource', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('http or https');
  await dialog.getByRole('button', { name: 'Complete task', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close task details' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true })).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Search tasks' })).toBeFocused();
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(results.violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) }))).toEqual([]);
});

test('desktop Today, details and settings meet automated accessibility checks', async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.screenshot({ path: 'test-results/today-desktop.png', fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) }))).toEqual([]);
  await page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true }).click();
  await page.screenshot({ path: 'test-results/task-details.png', fullPage: true });
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) }))).toEqual([]);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) }))).toEqual([]);
});

test('mobile navigation and drawer fit without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/today-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
  await page.getByRole('link', { name: /^All Tasks/ }).click();
  await expect(page.getByRole('heading', { name: 'All Tasks', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) }))).toEqual([]);
});

test('production PWA precaches the shell and keeps the demo available offline', async ({ page, context }) => {
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Focus Today' })).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Focus Today' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'You’re offline.' })).toBeVisible();
  const capture = page.getByRole('textbox', { name: 'Quick capture task' });
  await capture.fill('Offline demo task'); await capture.press('Enter');
  await expect(page.getByRole('button', { name: 'Open Offline demo task', exact: true })).toBeVisible();
  await context.setOffline(false);
});

test('filters combine source, priority and history dates without losing context', async ({ page }) => {
  await page.getByRole('link', { name: /^All Tasks/ }).click();
  await page.getByLabel('Filter source', { exact: true }).selectOption('Outlook');
  await page.getByLabel('Filter priority', { exact: true }).selectOption('high');
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Open Review EWRB regulatory update', exact: true })).toBeVisible();
  await page.getByLabel('Filter due date', { exact: true }).selectOption('none');
  await expect(page.getByRole('heading', { name: 'No tasks found' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await expect(page.getByRole('button', { name: /^Open / })).toHaveCount(10);
  await page.getByRole('link', { name: /^Completed/ }).click();
  await page.getByLabel('Completed from', { exact: true }).fill('2099-01-01');
  await expect(page.getByRole('heading', { name: 'Your story is still being written' })).toBeVisible();
  await page.getByRole('button', { name: 'Clear filters' }).click();
  await page.getByLabel('Search tasks', { exact: true }).fill('review sequence');
  await expect(page.getByRole('button', { name: 'Open Confirm handbook review schedule', exact: true })).toBeVisible();
});

test('unused workstreams can be renamed/removed and reset requires a choice', async ({ page }) => {
  await page.getByRole('link', { name: 'Workstreams', exact: true }).click();
  await page.getByLabel('New workstream name', { exact: true }).fill('Temporary');
  await page.getByRole('button', { name: 'Add workstream', exact: true }).click();
  await page.getByRole('button', { name: 'Rename Temporary', exact: true }).click();
  await page.getByLabel('New name for Temporary', { exact: true }).fill('Temporary renamed');
  await page.getByRole('button', { name: 'Save workstream name' }).click();
  await expect(page.getByRole('heading', { name: 'Temporary renamed', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove workstream Temporary renamed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Temporary renamed', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove workstream Programme Delivery', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Move all tasks');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await page.getByRole('button', { name: 'Reset demo workspace' }).click();
  await expect(page.getByRole('button', { name: 'Yes, restore demo' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Yes, restore demo' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Reset demo workspace' }).click();
  await page.getByRole('button', { name: 'Yes, restore demo' }).click();
  await expect(page.getByRole('status')).toContainText('Fictional demo workspace restored');
});

test('laptop and narrow phone layouts fit, and the manifest icons are available', async ({ page, request }) => {
  for (const width of [1366, 820, 320]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 1366, height: 900 });
  await page.screenshot({ path: 'test-results/today-laptop.png', fullPage: true });
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test('production assets work under the Azure content security policy', async ({ browser }) => {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const headers = JSON.parse(readFileSync('public/staticwebapp.config.json', 'utf8')).globalHeaders;
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/*', async route => {
      if (route.request().isNavigationRequest()) {
        const response = await route.fetch();
        await route.fulfill({ response, headers: { ...response.headers(), ...headers } });
      } else await route.continue();
    });
    await page.goto('http://127.0.0.1:4173/#today');
    await expect(page.getByRole('heading', { name: 'Focus Today' })).toBeVisible();
    const capture = page.getByRole('textbox', { name: 'Quick capture task' });
    await capture.fill('Security policy smoke test'); await capture.press('Enter');
    await expect(page.getByRole('button', { name: 'Open Security policy smoke test', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('manual deletion is recoverable without AI and retains notes', async ({ page }) => {
  await page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true }).click();
  const notes = await page.getByLabel('Task notes', { exact: true }).inputValue();
  await page.getByRole('button', { name: 'Move task to Trash', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'Trash', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review Year 3 assessment wording', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Restore task', exact: true }).click();
  await page.getByRole('link', { name: /^Today/ }).click();
  await page.getByRole('button', { name: 'Open Review Year 3 assessment wording', exact: true }).click();
  await expect(page.getByLabel('Task notes', { exact: true })).toHaveValue(notes);
});
