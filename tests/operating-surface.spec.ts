import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { test, expect } from './hosted-fixture';

// Exercise the same records through capture, organisation and operational views.
test('capture, organise, focus future work, wait, follow up, complete and find it in history', async ({ page }) => {
  await page.goto('/');
  const today = await page.getByLabel('Note date', { exact: true }).inputValue();
  await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await page.getByRole('button', { name: 'New project', exact: true }).click();
  const form = page.getByRole('form', { name: 'Create project', exact: true });
  await form.getByLabel('Project name', { exact: true }).fill('Assessment release');
  await form.getByLabel('Workstream', { exact: true }).selectOption('Assessment & Content');
  await form.getByLabel('Target date', { exact: true }).fill('2099-12-01');
  await form.getByLabel('Notes', { exact: true }).fill('Publish the approved assessment.');
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => item.id)).toEqual([]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await form.getByRole('button', { name: 'Create project', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Assessment release', exact: true })).toBeVisible();
  await page.screenshot({ path: 'test-results/final-projects-desktop.png', fullPage: true });
  await page.getByRole('link', { name: /^Today/ }).click();
  const capture = page.getByLabel('Quick capture task', { exact: true });
  await expect(page.getByRole('button', { name: 'Add task', exact: true })).toHaveCount(0);
  await capture.fill('Check the release with Prakash'); await capture.press('Enter');
  await page.getByRole('button', { name: 'Open Check the release with Prakash', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'TASK DETAILS' });
  await dialog.getByLabel('Workstream', { exact: true }).selectOption('Assessment & Content');
  await dialog.getByLabel('Project', { exact: true }).selectOption({ label: 'Assessment release' });
  await dialog.getByLabel('Due date', { exact: true }).fill('2099-12-01');
  await dialog.getByLabel('Priority', { exact: true }).selectOption('high');
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.locator('.focus-section').getByRole('button', { name: 'Open Check the release with Prakash', exact: true })).toBeVisible();
  const row = page.locator('.task-row').filter({ hasText: 'Check the release with Prakash' });
  await row.hover();
  await row.getByRole('button', { name: "Remove from Today's focus: Check the release with Prakash", exact: true }).click();
  await expect(row).toHaveCount(0);
  await page.getByRole('link', { name: 'Upcoming', exact: true }).click();
  const future = page.locator('.task-row').filter({ hasText: 'Check the release with Prakash' });
  // Metadata is part of the row's open target, not a tiny-chevron-only target.
  await future.locator('.task-date').click();
  await expect(dialog.getByLabel('Due date', { exact: true })).toHaveValue('2099-12-01');
  await dialog.getByLabel('Status', { exact: true }).selectOption('waiting');
  await dialog.getByLabel('Waiting on', { exact: true }).fill('Prakash');
  await dialog.getByLabel('Follow-up date', { exact: true }).fill(today);
  await dialog.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('link', { name: /^Today/ }).click();
  const followUp = page.locator('.today-sections .task-row').filter({ hasText: 'Check the release with Prakash' });
  await expect(followUp).toHaveCount(1); await expect(followUp.locator('.task-date')).toHaveText('Follow up today');
  const surfacedCount = await page.locator('.today-sections .task-row').count();
  await expect(page.locator('a[href="#today"] .nav-count')).toHaveText(String(surfacedCount));
  await page.getByRole('link', { name: /^Waiting/ }).click();
  await expect(page.getByRole('heading', { name: /^Waiting on Prakash/ })).toBeVisible();
  await page.getByRole('button', { name: 'Open Check the release with Prakash', exact: true }).click();
  await dialog.getByLabel('Completion note', { exact: true }).fill('Approved for release.');
  await dialog.getByRole('button', { name: 'Complete task', exact: true }).click();
  await page.getByRole('link', { name: 'Completed', exact: true }).click();
  await expect(page.locator('a[href="#completed"] .nav-count')).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Add task', exact: true })).toHaveCount(0);
  await page.getByLabel('Search tasks', { exact: true }).fill('Approved for release');
  await page.reload(); await page.getByLabel('Search tasks', { exact: true }).fill('Approved for release');
  await page.getByRole('button', { name: 'Open Check the release with Prakash', exact: true }).click();
  await expect(dialog.getByLabel('Project', { exact: true }).locator('option:checked')).toHaveText('Assessment release');
  await expect(dialog.getByLabel('Completion note', { exact: true })).toHaveValue('Approved for release.');
  await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download workspace backup' }).click();
  const download = await pending; const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.projects).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'Assessment release', workstream: 'Assessment & Content' })]));
  expect(backup.tasks.filter((task: { title: string }) => task.title === 'Check the release with Prakash')).toHaveLength(1);
});

test('capture destination is independent of filtering and project errors preserve input', async ({ page }) => {
  await page.goto('/#all');
  await page.getByLabel('Filter workstream', { exact: true }).selectOption('Programme Delivery');
  await page.getByLabel('Quick capture workstream', { exact: true }).selectOption('LMS / Digital');
  await expect(page.getByLabel('Filter workstream', { exact: true })).toHaveValue('Programme Delivery');
  await expect(page.getByRole('form', { name: 'Add task', exact: true }).getByRole('button', { name: 'Open conversation' })).toHaveCount(0);
  await page.getByLabel('Quick capture task', { exact: true }).fill('Capture in the selected area');
  await page.getByRole('button', { name: 'Add task', exact: true }).click();
  await page.getByRole('link', { name: /^Today/ }).click();
  await page.getByRole('button', { name: 'Open Capture in the selected area', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Workstream', { exact: true })).toHaveValue('LMS / Digital');
  await page.keyboard.press('Escape'); await page.getByRole('link', { name: 'Projects', exact: true }).click();
  for (let index = 0; index < 2; index++) {
    await page.getByRole('button', { name: 'New project', exact: true }).click();
    await page.getByRole('form', { name: 'Create project', exact: true }).getByLabel('Project name').fill('One project');
    await page.getByRole('button', { name: 'Create project', exact: true }).click();
  }
  await expect(page.getByRole('alert')).toContainText('already exists');
  await expect(page.getByRole('form', { name: 'Create project', exact: true }).getByLabel('Project name')).toHaveValue('One project');
  await expect(page.getByRole('heading', { name: 'One project', exact: true })).toHaveCount(1);
});

test('Today is ordered and unique, notebook feedback expires, and only Today has a date heading', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.today-sections .section-header h2')).toHaveCount(4);
  const headings = await page.locator('.today-sections .section-header h2').allTextContents();
  expect(headings.map(text => text.replace(/\d+$/, ''))).toEqual(["Today's focus", 'Overdue', 'Due today', 'Waiting / follow-up']);
  const taskNames = await page.locator('.today-sections .task-title').allTextContents();
  expect(new Set(taskNames).size).toBe(taskNames.length);
  await expect(page.locator('a[href="#today"] .nav-count')).toHaveText(String(taskNames.length));
  await expect(page.locator('.date-eyebrow')).toBeVisible();
  await page.getByLabel('Daily Note text', { exact: true }).fill('A short notebook entry.');
  await expect(page.getByRole('region', { name: 'Daily Note', exact: true }).getByRole('status')).toHaveText('Saved');
  await expect(page.getByRole('region', { name: 'Daily Note', exact: true }).getByRole('status')).toBeEmpty();
  for (const hash of ['all', 'upcoming', 'waiting', 'completed', 'projects', 'workstreams', 'assistant']) {
    await page.goto(`/#${hash}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.date-eyebrow')).toHaveCount(0);
    await expect(page.locator('.breadcrumb')).not.toContainText('My workspace');
  }
});

test('composer grows with text, preserves IME, and resets to a compact anchored input', async ({ page }) => {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
  let calls = 0;
  await page.route('**/api/assistant/chat', route => { calls++; return route.fulfill({ json: { output: [], calls: [], text: 'Done.' } }); });
  await page.goto('/#assistant');
  const input = page.getByLabel('Message', { exact: true });
  const small = (await input.boundingBox())!.height;
  await input.fill('One\nTwo\nThree\nFour\nFive\nSix');
  expect((await input.boundingBox())!.height).toBeGreaterThan(small);
  await input.dispatchEvent('keydown', { key: 'Enter', isComposing: true });
  expect(calls).toBe(0);
  await input.press('Enter'); await expect(page.getByRole('log')).toContainText('Done.');
  await expect(input).toHaveValue(''); expect((await input.boundingBox())!.height).toBe(small);
  const viewport = page.viewportSize()!;
  const composer = (await page.locator('.conversation-composer').boundingBox())!;
  expect(composer.y + composer.height).toBeLessThanOrEqual(viewport.height);
  expect(composer.y).toBeGreaterThan(viewport.height / 2);
  await page.screenshot({ path: 'test-results/final-conversation-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'test-results/final-conversation-mobile.png', fullPage: true });
});
