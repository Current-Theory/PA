import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './hosted-fixture';

async function connection(page: Page) {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
}

test('Today is the default, notes keep dates, survive reload, appear in search and backups', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Focus Today' })).toBeVisible();
  const notebook = page.getByRole('region', { name: 'Daily Note', exact: true });
  const date = await page.getByLabel('Note date', { exact: true }).inputValue();
  await page.getByLabel('Daily Note text', { exact: true }).fill('Meeting with Prakash\nWaiting for the revised assessment plan.');
  await expect(notebook.getByRole('status')).toHaveText('Saved on this device');
  await page.getByRole('button', { name: 'Previous day’s note', exact: true }).click();
  await page.getByLabel('Daily Note text', { exact: true }).fill('Yesterday: checked the proposal.');
  await expect(notebook.getByRole('status')).toHaveText('Saved on this device');
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByLabel('Daily Note text', { exact: true })).toContainText('Meeting with Prakash');
  await page.reload();
  await expect(page.getByLabel('Daily Note text', { exact: true })).toHaveValue('Meeting with Prakash\nWaiting for the revised assessment plan.');
  await page.keyboard.press('Control+k');
  await page.getByLabel('Search tasks and notes', { exact: true }).fill('Prakash');
  await page.getByRole('button', { name: new RegExp(date) }).click();
  await expect(page.getByLabel('Daily Note text', { exact: true })).toHaveValue('Meeting with Prakash\nWaiting for the revised assessment plan.');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download workspace backup' }).click();
  const download = await pending; const backup = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(backup.dailyNotes[date]).toContain('Meeting with Prakash');
  expect(Object.keys(backup.dailyNotes)).toHaveLength(2);
  expect(backup.tasks).toHaveLength(12);
});

for (const submit of ['button', 'keyboard'] as const) {
  test(`sending during dictation waits for the final words via ${submit}`, async ({ page }) => {
    await connection(page);
    const messages: string[] = [];
    await page.route('**/api/assistant/chat', route => {
      const input = route.request().postDataJSON().input;
      messages.push(input.at(-1).content);
      return route.fulfill({ json: { output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Saved.' }] }], calls: [], text: 'Saved.' } });
    });
    await page.addInitScript(() => {
      class Recognition {
        onstart?: () => void; onresult?: (event: unknown) => void; onend?: () => void;
        start() { this.onstart?.(); this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Review the proposal' } }, { isFinal: false, 0: { transcript: 'with' } }] }); }
        stop() { setTimeout(() => { this.onresult?.({ resultIndex: 1, results: [{ isFinal: true, 0: { transcript: 'Review the proposal' } }, { isFinal: true, 0: { transcript: 'with Prakash tomorrow.' } }] }); this.onend?.(); }, 100); }
        abort() { this.onend?.(); }
      }
      Object.assign(window, { SpeechRecognition: Recognition });
    });
    await page.goto('/#assistant');
    const input = page.getByLabel('Message', { exact: true });
    await input.fill('Please');
    await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
    if (submit === 'button') await page.getByRole('button', { name: 'Send message', exact: true }).click();
    else await input.press('Enter');
    await expect(page.getByRole('log')).toContainText('Saved.');
    expect(messages).toEqual(['Please Review the proposal with Prakash tomorrow.']);
    await expect(input).toHaveValue('');
  });
}

test('interim-only speech can be sent without a separate stop action', async ({ page }) => {
  await connection(page);
  let message = '';
  await page.route('**/api/assistant/chat', route => { message = route.request().postDataJSON().input.at(-1).content; return route.fulfill({ json: { output: [], calls: [], text: 'Received.' } }); });
  await page.addInitScript(() => {
    class Recognition {
      onresult?: (event: unknown) => void; onend?: () => void;
      start() { this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'Keep these final words.' } }] }); }
      stop() { this.onend?.(); } abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/#assistant'); await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Received.');
  expect(message).toBe('Keep these final words.');
});

test('speech failure keeps the transcript unsent, Shift+Enter inserts a line and Enter sends', async ({ page }) => {
  await connection(page);
  let calls = 0;
  await page.route('**/api/assistant/chat', route => { calls++; return route.fulfill({ json: { output: [], calls: [], text: 'Received.' } }); });
  await page.addInitScript(() => {
    class Recognition {
      onresult?: (event: unknown) => void; onerror?: (event: unknown) => void; onend?: () => void;
      start() { this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'Keep this draft.' } }] }); }
      stop() { this.onerror?.({ error: 'network' }); this.onend?.(); } abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/#assistant'); await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  const input = page.getByLabel('Message', { exact: true });
  await expect(input).toHaveValue('Keep this draft.'); expect(calls).toBe(0);
  await expect(page.getByRole('alert').first()).toContainText('Dictation is unavailable');
  await input.press('End'); await input.press('Shift+Enter'); await input.pressSequentially('Extra line');
  await expect(input).toHaveValue('Keep this draft.\nExtra line'); expect(calls).toBe(0);
  await input.press('Enter'); await expect(page.getByRole('log')).toContainText('Received.'); expect(calls).toBe(1);
});

test('all work surfaces stay plain, accessible and usable on a narrow screen', async ({ page }) => {
  await connection(page);
  for (const view of ['today', 'assistant', 'all', 'upcoming', 'waiting', 'completed', 'projects', 'workstreams', 'trash', 'search']) {
    await page.goto(`/#${view}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('body')).not.toContainText(/Less administration|clearer next step|Less noise|More progress|⌘|Ctrl \/|magic/i);
    expect(await page.locator('svg.lucide-sparkles, svg.lucide-star').count()).toBe(0);
    expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => item.id), view).toEqual([]);
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), view).toBe(true);
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  await page.goto('/#today');
  await page.screenshot({ path: 'test-results/refined-today-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'test-results/refined-today-mobile.png', fullPage: true });
});

test('an unsaved note survives navigation and can be retried after storage recovers', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByLabel('Daily Note text', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const original = IDBObjectStore.prototype.put;
    Object.assign(window, { restoreNoteStorage: () => { IDBObjectStore.prototype.put = original; } });
    IDBObjectStore.prototype.put = function () { throw new Error('Storage full'); };
  });
  await page.getByLabel('Daily Note text', { exact: true }).fill('Keep this unsaved note.');
  await expect(page.getByRole('alert')).toContainText('Storage full');
  await page.getByRole('link', { name: /^All Tasks/ }).click();
  await page.getByRole('link', { name: /^Today/ }).click();
  await expect(page.getByLabel('Daily Note text', { exact: true })).toHaveValue('Keep this unsaved note.');
  await page.evaluate(() => (window as unknown as Window & { restoreNoteStorage: () => void }).restoreNoteStorage());
  await page.getByRole('button', { name: 'Retry save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Daily Note', exact: true }).getByRole('status')).toHaveText('Saved on this device');
  await page.reload();
  await expect(page.getByLabel('Daily Note text', { exact: true })).toHaveValue('Keep this unsaved note.');
});

test('dictation timeout preserves the partial transcript without submitting it', async ({ page }) => {
  await connection(page);
  let calls = 0;
  await page.route('**/api/assistant/chat', route => { calls++; return route.fulfill({ json: { output: [], calls: [], text: 'Received.' } }); });
  await page.addInitScript(() => {
    class Recognition {
      onresult?: (event: unknown) => void;
      start() { this.onresult?.({ resultIndex: 0, results: [{ isFinal: false, 0: { transcript: 'Preserve this note.' } }] }); }
      stop() {} abort() {}
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/#assistant');
  await page.clock.install();
  await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.clock.fastForward(5100);
  await expect(page.getByLabel('Message', { exact: true })).toHaveValue('Preserve this note.');
  await expect(page.getByRole('alert').first()).toContainText('Dictation did not finish');
  expect(calls).toBe(0);
});
