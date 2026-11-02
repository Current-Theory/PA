import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { test, expect, type Page } from './hosted-fixture';

const pdf = { name: 'review.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nPRIVATE-ORIGINAL-FILE-CONTENT\n%%EOF') };
async function connected(page: Page) {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true, attachments: true } }));
}
async function uploads(page: Page) {
  const batches: string[][] = [];
  await page.route('**/api/assistant/attachments', async route => {
    const request = route.request();
    expect(request.headers()['content-type']).toContain('multipart/form-data; boundary=');
    const form = await new Request(request.url(), { method: 'POST', headers: request.headers(), body: new Uint8Array(request.postDataBuffer()!) }).formData();
    const files = form.getAll('files') as File[];
    batches.push(files.map(file => file.name));
    await route.fulfill({ json: { attachments: files.map((file, index) => ({ name: file.name, size: file.size, type: file.type, token: `opaque-private-upload-token-${index}-${'x'.repeat(40)}`, expiresAt: Date.now() + 3600000 })) } });
  });
  return batches;
}
async function storedWorkspace(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('earnlearn-demo-v1', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const state = await new Promise<unknown>((resolve, reject) => { const request = db.transaction('workspace').objectStore('workspace').get('demo'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close();
    const hasBlob = (value: unknown): boolean => value instanceof Blob || !!value && typeof value === 'object' && Object.values(value).some(hasBlob);
    return { text: JSON.stringify(state), hasBlob: hasBlob(state) };
  });
}

test('select/remove is local only; text and PDF upload together, immediate follow-ups reuse temporary context without storing raw files', async ({ page }) => {
  await connected(page); const batches = await uploads(page); const requests: Record<string, unknown>[] = [];
  await page.route('**/api/assistant/chat', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { output: [], calls: [], text: 'Summary received.' } }); });
  await page.goto('/#assistant');
  const chooser = page.getByLabel('Choose attachments', { exact: true });
  await chooser.setInputFiles(pdf);
  await expect(page.getByLabel('Selected attachments', { exact: true })).toContainText('review.pdf');
  expect(batches).toEqual([]); expect(requests).toEqual([]);
  await page.getByRole('button', { name: 'Remove attachment review.pdf', exact: true }).click();
  await expect(page.getByLabel('Selected attachments', { exact: true })).toHaveCount(0);
  await chooser.setInputFiles(pdf); await page.getByLabel('Message', { exact: true }).fill('Summarise this review.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Summary received.');
  expect(batches).toEqual([['review.pdf']]);
  expect(requests[0]).toMatchObject({ input: expect.arrayContaining([expect.objectContaining({ role: 'user', content: expect.stringContaining('Summarise this review.') })]), attachmentTokens: [expect.stringContaining('opaque-private-upload-token')] });
  expect(JSON.stringify(requests)).not.toContain('PRIVATE-ORIGINAL-FILE-CONTENT');
  await expect(page.getByLabel('Selected attachments', { exact: true })).toHaveCount(0);
  await page.getByLabel('Message', { exact: true }).fill('What dates matter?'); await page.getByLabel('Message', { exact: true }).press('Enter');
  await expect.poll(() => requests.length).toBe(2);
  expect(requests[1].attachmentTokens).toEqual(requests[0].attachmentTokens); expect(batches).toHaveLength(1);
  const state = await storedWorkspace(page);
  expect(state.hasBlob).toBe(false); expect(state.text).not.toContain('PRIVATE-ORIGINAL-FILE-CONTENT'); expect(state.text).not.toContain('opaque-private-upload-token');
  await page.reload(); await page.getByLabel('Message', { exact: true }).fill('Read that section again.'); await page.getByLabel('Message', { exact: true }).press('Enter');
  await expect.poll(() => requests.length).toBe(3);
  expect(requests[2].attachmentsUnavailable).toBe(true); expect(requests[2].attachmentTokens).toBeUndefined();
});

test('permitted multiple documents and images fit the responsive composer and retain attachment/tool functionality', async ({ page }) => {
  await connected(page); const batches = await uploads(page); let modelCalls = 0;
  await page.route('**/api/assistant/chat', route => {
    const request = route.request().postDataJSON(); modelCalls++;
    expect(request.attachmentTokens).toHaveLength(3);
    const args = { title: 'Review the attached assessment', notes: 'Action explicitly requested from the uploaded document.', workstream: 'Assessment & Content', dueDate: null, priority: 'normal', status: 'notStarted', waitingFor: null, followUpDate: null, projectId: null, checklist: [], focusToday: true };
    const call = { type: 'function_call', call_id: 'attachment-task', name: 'create_task', arguments: JSON.stringify(args) };
    return route.fulfill({ json: modelCalls === 1 ? { output: [call], calls: [call], text: '' } : { output: [], calls: [], text: 'Created the review task.' } });
  });
  await page.goto('/#assistant');
  const png = { name: 'diagram.png', mimeType: 'image/png', buffer: await readFile('public/pwa-192.png') };
  await page.getByLabel('Choose attachments', { exact: true }).setInputFiles([pdf, png, { name: `${'long-name-'.repeat(15)}.txt`, mimeType: 'text/plain', buffer: Buffer.from('Additional context') }]);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => item.id)).toEqual([]);
  await page.screenshot({ path: 'test-results/attachments-mobile.png', fullPage: true });
  await page.getByLabel('Message', { exact: true }).fill('Read these files and create the actions as tasks.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Created the review task.');
  expect(batches[0]).toHaveLength(3); expect(modelCalls).toBe(2);
  await page.getByRole('button', { name: 'Open navigation', exact: true }).click(); await page.getByRole('link', { name: /^Today/ }).click();
  await page.getByRole('button', { name: 'Open Review the attached assessment', exact: true }).click();
  await expect(page.getByLabel('Task notes', { exact: true })).toHaveValue('Action explicitly requested from the uploaded document.');
});

test('file selection rejects unsupported types, oversized files, excess count and combined size without uploading', async ({ page }) => {
  await connected(page); const batches = await uploads(page); await page.goto('/#assistant');
  await page.getByLabel('Choose attachments', { exact: true }).setInputFiles({ name: 'active.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
  await expect(page.getByRole('alert')).toContainText('Use PDF');
  await page.getByLabel('Choose attachments', { exact: true }).setInputFiles({ ...pdf, mimeType: 'text/html' });
  await expect(page.getByRole('alert')).toContainText('matching file type');
  for (const sizes of [[10 * 1024 * 1024 + 1], [8 * 1024 * 1024, 8 * 1024 * 1024, 4 * 1024 * 1024 + 1], [1, 1, 1, 1]]) {
    await page.evaluate(sizes => {
      const data = new DataTransfer(); sizes.forEach((size, index) => data.items.add(new File([new Uint8Array(size)], `file${index}.txt`, { type: 'text/plain' })));
      const input = document.querySelector<HTMLInputElement>('input[type=file]')!; input.files = data.files; input.dispatchEvent(new Event('change', { bubbles: true }));
    }, sizes);
    await expect(page.getByRole('alert')).toBeVisible(); await expect(page.getByLabel('Selected attachments', { exact: true })).toHaveCount(0);
  }
  expect(batches).toEqual([]);
});

test('upload and processing failures keep text/files, leave no phantom exchange and can be retried', async ({ page }) => {
  await connected(page); let failUpload = true; let failModel = true; let uploaded = 0;
  await page.route('**/api/assistant/attachments', route => {
    uploaded++;
    return route.fulfill({ status: failUpload ? 502 : 200, json: failUpload ? { error: 'Upload failed. Try again.' } : { attachments: [{ name: 'review.pdf', size: pdf.buffer.length, type: 'application/pdf', token: 'temporary-opaque-upload-token-'.repeat(2), expiresAt: Date.now() + 3600000 }] } });
  });
  await page.route('**/api/assistant/chat', route => route.fulfill({ status: failModel ? 400 : 200, json: failModel ? { error: 'The attachment could not be processed. Attach it again.' } : { output: [], calls: [], text: 'Summary received.' } }));
  await page.goto('/#assistant'); await page.getByLabel('Choose attachments', { exact: true }).setInputFiles(pdf);
  const message = page.getByLabel('Message', { exact: true }); await message.fill('Keep my typed question.');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Upload failed'); await expect(message).toHaveValue('Keep my typed question.');
  failUpload = false; await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('could not be processed'); await expect(message).toHaveValue('Keep my typed question.');
  await expect(page.getByLabel('Selected attachments', { exact: true })).toContainText('review.pdf');
  await expect(page.getByRole('log')).not.toContainText('Summary received.');
  failModel = false; await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Summary received.'); expect(uploaded).toBe(2);
  await expect(message).toHaveValue('');
  const state = await storedWorkspace(page); expect(state.text).not.toContain('temporary-opaque-upload-token'); expect(state.hasBlob).toBe(false);
});

test('drag/drop selects without submitting and expiry is carried into immediate follow-up requests honestly', async ({ page }) => {
  await connected(page); await uploads(page); const requests: Record<string, unknown>[] = [];
  await page.route('**/api/assistant/chat', route => { const request = route.request().postDataJSON(); requests.push(request); return route.fulfill({ json: { output: [], calls: [], text: request.attachmentsUnavailable ? 'Please attach the file again.' : 'Read the file.' } }); });
  await page.goto('/#assistant');
  await expect(page.getByRole('button', { name: 'Attach files', exact: true })).toBeEnabled();
  await page.evaluate(() => {
    const data = new DataTransfer(); data.items.add(new File(['Notes for review'], 'notes.txt', { type: 'text/plain' }));
    document.querySelector('.conversation-composer')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data }));
  });
  await expect(page.getByLabel('Selected attachments', { exact: true })).toContainText('notes.txt'); expect(requests).toEqual([]);
  await page.getByLabel('Message', { exact: true }).fill('Read this.'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Read the file.');
  await page.clock.install(); await page.clock.fastForward(3601000);
  await page.getByLabel('Message', { exact: true }).fill('Explain the section again.'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(page.getByRole('log')).toContainText('Please attach the file again.');
  expect(requests.at(-1)?.attachmentsUnavailable).toBe(true); expect(requests.at(-1)?.attachmentTokens).toBeUndefined();
});
