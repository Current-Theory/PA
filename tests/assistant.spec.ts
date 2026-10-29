import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const note = 'I need to design the new EarnLearn package, and Victoria has asked me to do the quality assurance.';
const proposal = { summary: 'Keep the package design and its quality review together, with clear next steps.', tasks: [
  { title: 'Quality-assure the new EarnLearn package', notes: 'Victoria requested quality assurance of the new package.', workstream: 'Regulatory & Quality', status: 'notStarted', priority: 'normal', dueDate: null, waitingFor: '', followUpDate: null, checklist: ['Review the package against requirements', 'Record findings and recommendations'], focusToday: true },
  { title: 'Design the new EarnLearn package', notes: 'Develop the package design for review.', workstream: 'Projects', status: 'notStarted', priority: 'normal', dueDate: null, waitingFor: '', followUpDate: null, checklist: ['Draft the package design'], focusToday: true }
] };

test.beforeEach(async ({ page }) => {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: false } }));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focus Today' })).toBeVisible();
});

test('imports reviewed suggestions in the current workstream and finds them on Today with their context', async ({ page }) => {
  await page.getByRole('link', { name: 'Workstreams', exact: true }).click();
  await page.getByRole('button', { name: 'Capture with ChatGPT in Regulatory & Quality', exact: true }).click();
  const panel = page.getByRole('dialog', { name: 'Think out loud. Find your next step.' });
  await expect(panel.getByLabel('Capture workstream', { exact: true })).toHaveValue('Regulatory & Quality');
  await panel.getByLabel('What needs to happen?', { exact: true }).fill(note);
  await panel.getByRole('button', { name: 'View prepared prompt' }).click();
  await expect(panel.getByLabel('Prepared ChatGPT prompt', { exact: true })).toContainText('Selected workstream: Regulatory & Quality');
  await panel.getByRole('button', { name: 'Import ChatGPT reply', exact: true }).click();
  await panel.getByLabel('Paste ChatGPT’s JSON reply', { exact: true }).fill('```json\n' + JSON.stringify(proposal) + '\n```');
  await panel.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByRole('link', { name: 'All Tasks 10', exact: true })).toBeAttached();
  await expect(panel.getByLabel('Suggestion 1 due date', { exact: true })).toHaveValue('');
  await panel.getByLabel('Suggestion 1 priority', { exact: true }).selectOption('high');
  await page.screenshot({ path: 'test-results/capture-assistant.png' });
  const violations = (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => ({ target: n.target, message: n.failureSummary })) }));
  expect(violations).toEqual([]);
  await panel.getByRole('button', { name: 'Add 2 tasks', exact: true }).click();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Workstreams', exact: true })).toBeVisible();
  await expect(page.getByLabel('Quick capture workstream', { exact: true })).toHaveValue('Regulatory & Quality');
  await page.getByRole('link', { name: /^Today/ }).click();
  await page.getByRole('button', { name: 'Open Quality-assure the new EarnLearn package', exact: true }).click();
  const drawer = page.getByRole('dialog', { name: 'TASK DETAILS' });
  await expect(drawer.getByLabel('Workstream', { exact: true })).toHaveValue('Regulatory & Quality');
  await expect(drawer.getByLabel('Task notes', { exact: true })).toContainText(note);
  await expect(drawer.getByLabel('Priority', { exact: true })).toHaveValue('high');
  await expect(drawer.getByRole('checkbox', { name: 'Record findings and recommendations', exact: true })).toBeVisible();
});

test('automatic suggestions use only an explicit send, return in-panel, and never auto-save', async ({ page }) => {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
  let calls = 0;
  await page.route('**/api/assistant/capture', async route => {
    calls++;
    expect(route.request().postDataJSON().note).toBe(note);
    expect(Object.keys(route.request().postDataJSON()).sort()).toEqual(['note', 'today', 'workstream', 'workstreams']);
    await route.fulfill({ json: proposal });
  });
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await page.getByLabel('What needs to happen?', { exact: true }).fill(note);
  expect(calls).toBe(0);
  await page.getByRole('button', { name: 'Suggest tasks', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Review your next steps', exact: true })).toBeVisible();
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Close capture assistant' }).click();
  await expect(page.getByRole('link', { name: 'All Tasks 10', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await expect(page.getByLabel('What needs to happen?', { exact: true })).toHaveValue(note);
});

test('bad imports and API failures keep the note and never create partial tasks', async ({ page }) => {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
  await page.route('**/api/assistant/capture', route => route.fulfill({ status: 502, json: { error: 'The assistant could not respond. Your note is still here.' } }));
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await page.getByLabel('What needs to happen?', { exact: true }).fill(note);
  await page.getByRole('button', { name: 'Suggest tasks', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Your note is still here');
  await expect(page.getByLabel('What needs to happen?', { exact: true })).toHaveValue(note);
  await page.getByRole('button', { name: 'Import ChatGPT reply', exact: true }).click();
  await page.getByLabel('Paste ChatGPT’s JSON reply', { exact: true }).fill('{broken');
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('JSON response');
  await expect(page.getByRole('button', { name: /^Add .*tasks$/ })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('link', { name: 'All Tasks 10', exact: true })).toBeVisible();
});

test('quick capture uses the selected workstream instead of the default', async ({ page }) => {
  await page.getByRole('link', { name: 'Workstreams', exact: true }).click();
  await page.getByLabel('Quick capture workstream', { exact: true }).selectOption('Regulatory & Quality');
  await page.getByLabel('Quick capture task', { exact: true }).fill('Check package QA requirements');
  await page.getByLabel('Quick capture task', { exact: true }).press('Enter');
  await page.getByRole('link', { name: /^Today/ }).click();
  await page.getByRole('button', { name: 'Open Check package QA requirements', exact: true }).click();
  await expect(page.getByRole('dialog').getByLabel('Workstream', { exact: true })).toHaveValue('Regulatory & Quality');
});

test('mobile capture is accessible and imports a JSON file without navigating away', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await page.getByRole('button', { name: 'Import ChatGPT reply', exact: true }).click();
  await page.getByLabel('Import ChatGPT JSON file', { exact: true }).setInputFiles({ name: 'tasks.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(proposal)) });
  await expect(page.getByRole('heading', { name: 'Review your next steps', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove suggestion 2', exact: true }).click();
  await page.getByLabel('Show in Focus Today', { exact: false }).uncheck();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))).toEqual([]);
  await page.screenshot({ path: 'test-results/capture-mobile.png' });
  await page.getByRole('button', { name: 'Add 1 task', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open Quality-assure the new EarnLearn package', exact: true })).toHaveCount(0);
});

test('dictation starts only on request and retains multiple final speech segments', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void;
      onresult?: (event: unknown) => void;
      onend?: () => void;
      start() { this.onstart?.(); this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Victoria asked for quality assurance.' } }, { isFinal: true, 0: { transcript: 'Review the new package.' } }] }); }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await expect(page.getByLabel('What needs to happen?', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
  await expect(page.getByLabel('What needs to happen?', { exact: true })).toHaveValue('Victoria asked for quality assurance. Review the new package.');
  await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start dictation', exact: true })).toBeVisible();
});

test('denied microphone access keeps the note and offers typing instead', async ({ page }) => {
  await page.addInitScript(() => {
    class Recognition {
      onerror?: (event: { error: string }) => void;
      start() { this.onerror?.({ error: 'not-allowed' }); }
      stop() {}
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await page.getByLabel('What needs to happen?', { exact: true }).fill('Keep my typed context');
  await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Microphone access was not allowed');
  await expect(page.getByLabel('What needs to happen?', { exact: true })).toHaveValue('Keep my typed context');
  await expect(page.getByRole('button', { name: 'Copy prompt for ChatGPT', exact: true })).toBeEnabled();
});

test('changing the original note invalidates old proposals before they can be added', async ({ page }) => {
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await page.getByLabel('What needs to happen?', { exact: true }).fill(note);
  await page.getByRole('button', { name: 'Import ChatGPT reply', exact: true }).click();
  await page.getByLabel('Paste ChatGPT’s JSON reply', { exact: true }).fill(JSON.stringify(proposal));
  await page.getByRole('button', { name: 'Review suggestions', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Add 2 tasks', exact: true })).toBeEnabled();
  await expect(page.getByLabel('Paste ChatGPT’s JSON reply', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Describe the work', exact: true }).click();
  await page.getByLabel('What needs to happen?', { exact: true }).fill('Actually, focus on a different package.');
  await expect(page.getByRole('button', { name: /^Add .*tasks$/ })).toBeDisabled();
  await expect(page.getByRole('heading', { name: 'Review your next steps', exact: true })).toHaveCount(0);
});

test('hosted sign-in opens separately and a connection retry preserves the work note', async ({ page }) => {
  let authorised = false;
  await page.route('**/api/assistant/status', route => route.fulfill({ status: authorised ? 200 : 401, json: authorised ? { ready: true } : { error: 'Sign in required' } }));
  await page.getByRole('button', { name: 'Capture with ChatGPT', exact: true }).click();
  await page.getByLabel('What needs to happen?', { exact: true }).fill(note);
  const signIn = page.getByRole('link', { name: 'Sign in to Work Hub', exact: true });
  await expect(signIn).toHaveAttribute('target', '_blank');
  await expect(signIn).toHaveAttribute('href', '/.auth/login/aad?post_login_redirect_uri=/assistant-connected.html');
  authorised = true;
  await page.getByRole('button', { name: 'Check connection', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Suggest tasks', exact: true })).toBeVisible();
  await expect(page.getByLabel('What needs to happen?', { exact: true })).toHaveValue(note);
});
