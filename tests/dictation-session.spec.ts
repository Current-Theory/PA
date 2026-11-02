import { test, expect, type Page } from './hosted-fixture';

type Result = { text: string; final: boolean };
declare global {
  interface Window {
    dictationTest: {
      starts: number; stops: number; stopDelay: number; stopResults?: Result[]; hangOnStop: boolean; failStartAt?: number;
      emit: (results: Result[]) => void; end: () => void; replay: (results: Result[]) => void; replayEnd: () => void;
      fail: (error: string) => void;
    };
  }
}
async function setup(page: Page) {
  const sent: string[] = [];
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
  await page.route('**/api/assistant/chat', route => {
    sent.push(route.request().postDataJSON().input.at(-1).content);
    return route.fulfill({ json: { output: [], calls: [], text: 'Received.' } });
  });
  await page.addInitScript(() => {
    type SpeechEvent = { resultIndex: number; results: { isFinal: boolean; 0: { transcript: string } }[] };
    const instances: Recognition[] = [];
    const latest = () => instances[instances.length - 1];
    let lateResult: ((event: SpeechEvent) => void) | null | undefined;
    let lateEnd: (() => void) | null | undefined;
    const eventFor = (results: Result[]): SpeechEvent => ({ resultIndex: 0, results: results.map(result => ({ isFinal: result.final, 0: { transcript: result.text } })) });
    class Recognition {
      onstart?: (() => void) | null; onend?: (() => void) | null;
      onresult?: ((event: SpeechEvent) => void) | null; onerror?: ((event: { error: string }) => void) | null;
      start() {
        instances.push(this); window.dictationTest.starts++;
        if (window.dictationTest.starts === window.dictationTest.failStartAt) throw new Error('Recognition failed to restart');
        this.onstart?.();
      }
      stop() {
        window.dictationTest.stops++;
        if (window.dictationTest.hangOnStop) return;
        setTimeout(() => {
          if (window.dictationTest.stopResults) this.onresult?.(eventFor(window.dictationTest.stopResults));
          this.onend?.();
        }, window.dictationTest.stopDelay);
      }
      abort() { this.onend?.(); }
    }
    window.dictationTest = {
      starts: 0, stops: 0, stopDelay: 0, hangOnStop: false,
      emit: results => latest().onresult?.(eventFor(results)),
      end: () => { lateResult = latest().onresult; lateEnd = latest().onend; latest().onend?.(); },
      replay: results => lateResult?.(eventFor(results)), replayEnd: () => lateEnd?.(),
      fail: error => { const end = latest().onend; latest().onerror?.({ error }); end?.(); }
    };
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/#assistant');
  await expect(page.getByText('Connected', { exact: true })).toBeVisible();
  return sent;
}
const input = (page: Page) => page.getByLabel('Message', { exact: true });
const listen = (page: Page) => page.getByRole('button', { name: 'Start dictation', exact: true }).click();
const emit = (page: Page, results: Result[]) => page.evaluate(results => window.dictationTest.emit(results), results);
const pause = (page: Page) => page.evaluate(() => window.dictationTest.end());
const runs = (page: Page, count: number) => expect.poll(() => page.evaluate(() => window.dictationTest.starts)).toBe(count);

test('pauses preserve one Listening session, typed text and interim/final speech in order without replay duplicates', async ({ page }) => {
  const sent = await setup(page);
  await input(page).fill('Typed first.'); await listen(page);
  await emit(page, [{ text: 'Review the plan.', final: true }, { text: 'Keep this interim.', final: false }]);
  await pause(page); await runs(page, 2);
  await expect(input(page)).toHaveValue('Typed first. Review the plan. Keep this interim.');
  await expect(page.getByRole('button', { name: 'Stop dictation', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Listening…', { exact: true })).toBeVisible();
  const second = [{ text: 'Then call Prakash.', final: true }];
  await emit(page, second); await emit(page, second);
  await page.evaluate(() => { window.dictationTest.replay([{ text: 'Review the plan. Keep this interim.', final: true }]); window.dictationTest.replayEnd(); });
  await pause(page); await runs(page, 3);
  await emit(page, [{ text: 'Before Friday.', final: false }]);
  await expect(input(page)).toHaveValue('Typed first. Review the plan. Keep this interim. Then call Prakash.');
  expect(sent).toEqual([]);
  await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Start dictation', exact: true })).toBeEnabled();
  await expect(input(page)).toHaveValue('Typed first. Review the plan. Keep this interim. Then call Prakash. Before Friday.');
  await page.clock.install(); await page.clock.fastForward(1000);
  expect(await page.evaluate(() => window.dictationTest.starts)).toBe(3);
  expect(sent).toEqual([]);
});

for (const action of ['button', 'Enter'] as const) {
  test(`Send via ${action} after automatic restart captures delayed final words and submits exactly once`, async ({ page }) => {
    const sent = await setup(page);
    await input(page).fill('Please'); await listen(page);
    await emit(page, [{ text: 'review the proposal', final: true }]); await pause(page); await runs(page, 2);
    await emit(page, [{ text: 'with', final: false }]);
    await page.evaluate(() => {
      window.dictationTest.stopDelay = 150;
      window.dictationTest.stopResults = [{ text: 'with Prakash tomorrow.', final: true }];
    });
    if (action === 'button') await page.getByRole('button', { name: 'Send message', exact: true }).click();
    else await input(page).press('Enter');
    // A second submit event while finalising must not create another request.
    await page.locator('.conversation-composer').dispatchEvent('submit');
    await expect(page.getByRole('log')).toContainText('Received.');
    expect(sent).toEqual(['Please review the proposal with Prakash tomorrow.']);
    await expect(input(page)).toHaveValue('');
    await page.clock.install(); await page.clock.fastForward(1000);
    expect(await page.evaluate(() => window.dictationTest.starts)).toBe(2);
    expect(await page.evaluate(() => window.dictationTest.stops)).toBe(1);
  });
}

for (const action of ['Stop', 'Send'] as const) {
  test(`${action} in the automatic restart gap cancels restarting and retains all recognised words`, async ({ page }) => {
    const sent = await setup(page); await page.clock.install(); await page.clock.pauseAt(new Date()); await listen(page);
    await emit(page, [{ text: 'Retain this segment.', final: false }]); await pause(page);
    await expect(page.getByRole('button', { name: 'Stop dictation', exact: true })).toBeVisible();
    if (action === 'Stop') await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
    else await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await page.clock.fastForward(1000);
    expect(await page.evaluate(() => window.dictationTest.starts)).toBe(1);
    if (action === 'Stop') { await expect(input(page)).toHaveValue('Retain this segment.'); expect(sent).toEqual([]); }
    else { await expect(page.getByRole('log')).toContainText('Received.'); expect(sent).toEqual(['Retain this segment.']); }
  });
}

test('manual Stop waits for the final transcript and leaves it editable without sending', async ({ page }) => {
  const sent = await setup(page); await listen(page);
  await emit(page, [{ text: 'First segment.', final: true }]); await pause(page); await runs(page, 2);
  await emit(page, [{ text: 'Last', final: false }]);
  await page.evaluate(() => { window.dictationTest.stopDelay = 100; window.dictationTest.stopResults = [{ text: 'Last words retained.', final: true }]; });
  await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
  await expect(input(page)).toHaveValue('First segment. Last words retained.');
  await input(page).press('End'); await input(page).pressSequentially(' Edited.');
  await expect(input(page)).toHaveValue('First segment. Last words retained. Edited.');
  expect(sent).toEqual([]);
});

test('network failure after restarting preserves accumulated finals and interim text without sending or retrying', async ({ page }) => {
  const sent = await setup(page); await input(page).fill('Typed note.'); await listen(page);
  await emit(page, [{ text: 'First words.', final: true }]); await pause(page); await runs(page, 2);
  await emit(page, [{ text: 'Keep these too.', final: false }]);
  await page.evaluate(() => window.dictationTest.fail('network'));
  await expect(input(page)).toHaveValue('Typed note. First words. Keep these too.');
  await expect(page.getByRole('alert')).toContainText('Dictation is unavailable');
  await expect(page.getByRole('button', { name: 'Start dictation', exact: true })).toBeEnabled();
  await page.clock.install(); await page.clock.fastForward(1000);
  expect(await page.evaluate(() => window.dictationTest.starts)).toBe(2);
  expect(sent).toEqual([]);
});

test('no-speech silence recovers invisibly, while a failed restart stops safely with the transcript retained', async ({ page }) => {
  const sent = await setup(page); await listen(page);
  await emit(page, [{ text: 'Keep this.', final: false }]);
  await page.evaluate(() => window.dictationTest.fail('no-speech')); await runs(page, 2);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Listening…', { exact: true })).toBeVisible();
  await page.evaluate(() => { window.dictationTest.failStartAt = 3; window.dictationTest.end(); }); await runs(page, 3);
  await expect(input(page)).toHaveValue('Keep this.');
  await expect(page.getByRole('alert')).toContainText('could not start'); expect(sent).toEqual([]);
});

test('the same words intentionally spoken in a new run are not lost to global text deduplication', async ({ page }) => {
  const sent = await setup(page); await listen(page);
  await emit(page, [{ text: 'Check again.', final: true }]); await pause(page); await runs(page, 2);
  await emit(page, [{ text: 'Check again.', final: true }]);
  await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
  await expect(input(page)).toHaveValue('Check again. Check again.'); expect(sent).toEqual([]);
});

test('leaving the conversation cancels a scheduled microphone restart', async ({ page }) => {
  await setup(page); await page.clock.install(); await page.clock.pauseAt(new Date()); await listen(page);
  await pause(page); await page.getByRole('link', { name: /^Today/ }).click(); await page.clock.fastForward(1000);
  expect(await page.evaluate(() => window.dictationTest.starts)).toBe(1);
});
