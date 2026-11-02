import { test, expect, type Page } from '@playwright/test';
import { readFile, writeFile, mkdir, rm, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';
import { createServer } from 'node:http';

async function exerciseTaskHistory(page: Page, reload: () => Promise<void>) {
  await expect(page.getByRole('heading', { name: "Today's focus" })).toBeVisible();
  await page.getByRole('textbox', { name: 'Quick capture task' }).fill('Try my downloadable app');
  await page.getByRole('textbox', { name: 'Quick capture task' }).press('Enter');
  await page.getByRole('button', { name: 'Open Try my downloadable app', exact: true }).click();
  await page.getByLabel('Task notes', { exact: true }).fill('This note should survive reopening the local file.');
  await page.getByLabel('Completion note', { exact: true }).fill('Portable workflow tested.');
  await page.getByRole('button', { name: 'Complete task', exact: true }).click();
  await page.getByRole('link', { name: /^Completed/ }).click();
  await reload();
  await page.getByRole('button', { name: 'Open Try my downloadable app', exact: true }).click();
  await expect(page.getByLabel('Task notes', { exact: true })).toHaveValue('This note should survive reopening the local file.');
  await expect(page.getByLabel('Completion note', { exact: true })).toHaveValue('Portable workflow tested.');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  await expect(page.getByText('This download runs directly from its HTML file.', { exact: false })).toBeVisible();
}

test('the delivered ZIP opens as a local file, works offline and retains task history', async ({ browser }) => {
  test.skip(process.env.PORTABLE_FILE_URL_BLOCKED === '1', 'Managed Chromium URL policy blocks file URLs; packaged bytes are separately tested over loopback.');
  const directory = await mkdtemp(join(tmpdir(), 'earnlearn-download-'));
  const context = await browser.newContext({ offline: true });
  try {
    const contents = unzipSync(await readFile('downloads/EarnLearn-Work-Hub.zip'));
    expect(Object.keys(contents).sort()).toEqual(['EarnLearn Work Hub.html', 'START HERE.txt', 'THIRD-PARTY-NOTICES.txt']);
    const filename = join(directory, 'EarnLearn Work Hub.html');
    await writeFile(filename, contents['EarnLearn Work Hub.html']);
    expect(strFromU8(contents['START HERE.txt'])).toContain('Extract this ZIP first');
    const page = await context.newPage();
    const networkRequests: string[] = [];
    const errors: string[] = [];
    page.on('request', request => { if (/^https?:/.test(request.url())) networkRequests.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(filename).href + '#today');
    await exerciseTaskHistory(page, async () => { await page.reload(); });
    expect(networkRequests).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); await rm(directory, { recursive: true, force: true }); }
});

test('the exact packaged HTML needs no subresources and retains context through offline use', async ({ browser }) => {
  const contents = unzipSync(await readFile('downloads/EarnLearn-Work-Hub.zip'));
  const html = strFromU8(contents['EarnLearn Work Hub.html']);
  // Use an ordinary HTTP harness because managed Chromium may disallow file://.
  // No policy is changed. Serve only the bytes that the user actually downloads.
  const server = createServer((_request, response) => { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); response.end(html); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not start portable test harness.');
  const origin = `http://127.0.0.1:${address.port}`;
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    const page = await context.newPage();
    const subresources: string[] = [], errors: string[] = [];
    page.on('request', request => { if (!request.isNavigationRequest() && !request.url().startsWith('data:')) subresources.push(request.url()); });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/#today');
    await expect(page.getByRole('heading', { name: "Today's focus" })).toBeVisible();
    await context.setOffline(true);
    await exerciseTaskHistory(page, async () => {
      // Reloading the HTTP harness needs loopback access; all editing is offline.
      await context.setOffline(false); await page.reload(); await context.setOffline(true);
    });
    expect(subresources).toEqual([]);
    expect(errors).toEqual([]);
  } finally { await context.close(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

test('download ZIP and embedded files use ordinary names safe to extract on Windows', async () => {
  const archive = unzipSync(await readFile('downloads/EarnLearn-Work-Hub.zip'));
  for (const filename of Object.keys(archive)) {
    expect(filename).not.toMatch(/[\\/:*?"<>|]/);
    expect(filename).not.toContain('..');
  }
  const html = strFromU8(archive['EarnLearn Work Hub.html']);
  expect(html).toContain('<html lang="en-NZ">');
  expect(html).not.toContain('<script src=');
  expect(html).not.toContain('type="module"');
  // Ensure source ZIP remains a valid extractable file independently of Chromium.
  const directory = await mkdtemp(join(tmpdir(), 'earnlearn-zip-'));
  try { await mkdir(join(directory, 'extracted')); for (const [filename, bytes] of Object.entries(archive)) await writeFile(join(directory, 'extracted', filename), bytes); }
  finally { await rm(directory, { recursive: true, force: true }); }
});
