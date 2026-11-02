import { test, expect, type Page } from './hosted-fixture';
import AxeBuilder from '@axe-core/playwright';
import type { ChatRequest, ChatResponse, FunctionCall } from '../src/assistant/contracts';
import type { Task, Project } from '../src/lib/model';
import { addDays, parseDate } from '../src/lib/dates';
import { readFile } from 'node:fs/promises';

const nextMonday = (today: string) => addDays(today, (8 - parseDate(today).getDay()) % 7 || 7);
const createArgs = (overrides: Record<string, unknown> = {}) => ({ title: 'Review Moodle capstone questions', notes: 'Quality-control review before meeting with Vittoria.', workstream: 'Assessment & Content', dueDate: null, priority: 'low', status: 'notStarted', waitingFor: null, followUpDate: null, projectId: null, checklist: ['Review questions', 'Record findings'], focusToday: false, ...overrides });
const call = (name: string, args: unknown): ChatResponse => {
  const item: FunctionCall = { type: 'function_call', call_id: crypto.randomUUID(), name, arguments: JSON.stringify(args) };
  return { output: [{ ...item }], calls: [item], text: '' };
};
const answer = (text: string): ChatResponse => ({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }], calls: [], text });
const result = (request: ChatRequest) => JSON.parse(request.input.at(-1)!.output as string);
async function model(page: Page, planner: (request: ChatRequest) => ChatResponse) {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
  await page.route('**/api/assistant/chat', route => route.fulfill({ json: planner(route.request().postDataJSON()) }));
}
async function send(page: Page, text: string) { await page.getByLabel('Message your assistant', { exact: true }).fill(text); await page.getByRole('button', { name: 'Send message', exact: true }).click(); }
async function manualTask(page: Page, title: string) { await page.getByRole('link', { name: /^Today/ }).click(); await page.getByLabel('Quick capture task', { exact: true }).fill(title); await page.getByLabel('Quick capture task', { exact: true }).press('Enter'); await expect(page.getByRole('button', { name: `Open ${title}`, exact: true })).toBeVisible(); }

test('natural creation executes tools directly and a follow-up reschedules the same persistent record', async ({ page }) => {
  await model(page, request => {
    const last = request.input.at(-1)!;
    if (last.type === 'function_call_output') return answer(result(request).name === 'create_task' ? 'Added the Moodle review for next Monday at low priority.' : 'Moved that Moodle review to the following Monday.');
    if ((last.content as string).startsWith('Move that')) { const task = request.context.recentTasks[0]; return call('reschedule_task', { taskId: task.id, expectedRevision: task.revision, dueDate: addDays(nextMonday(request.context.today), 7) }); }
    return call('create_task', createArgs({ dueDate: nextMonday(request.context.today) }));
  });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'Less administration.' })).toBeVisible();
  await send(page, 'I need to review those Moodle questions next week, but it’s not urgent.');
  await expect(page.getByRole('log')).toContainText('Added the Moodle review for next Monday');
  await send(page, 'Move that Moodle review to the following Monday.');
  await expect(page.getByRole('log')).toContainText('Moved that Moodle review');
  await page.getByRole('link', { name: /^All Tasks/ }).click(); await page.getByLabel('Search tasks', { exact: true }).fill('Moodle capstone');
  await expect(page.getByRole('button', { name: 'Open Review Moodle capstone questions', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Open Review Moodle capstone questions', exact: true }).click();
  await expect(page.getByLabel('Priority', { exact: true })).toHaveValue('low');
  await expect(page.getByLabel('Task notes', { exact: true })).toHaveValue('Quality-control review before meeting with Vittoria.');
  await expect(page.getByRole('checkbox', { name: 'Record findings', exact: true })).toBeVisible();
});

test('a completion request looks up the real task and keeps it in history', async ({ page }) => {
  await model(page, request => {
    if (request.input.at(-1)!.type !== 'function_call_output') return call('search_tasks', { query: 'Logan', includeCompleted: false, includeDeleted: false, limit: 20 });
    const output = result(request);
    if (output.name === 'search_tasks') { const task = output.data[0] as Task; return call('complete_task', { taskId: task.id, expectedRevision: task.revision, outcome: 'Logan update finished.' }); }
    return answer('Completed “Send Logan update”. Its context is kept in your work history.');
  });
  await page.goto('/#today'); await manualTask(page, 'Send Logan update'); await page.getByRole('link', { name: 'Assistant', exact: true }).click();
  await send(page, 'I’ve finished the Logan thing.'); await expect(page.getByRole('log')).toContainText('Completed “Send Logan update”');
  await page.getByRole('link', { name: /^Completed/ }).click(); await page.getByLabel('Search tasks', { exact: true }).fill('Logan update finished');
  await expect(page.getByRole('button', { name: 'Open Send Logan update', exact: true })).toBeVisible();
});

test('ambiguous references ask for a choice and never complete an arbitrary task', async ({ page }) => {
  await model(page, request => {
    const last = request.input.at(-1)!;
    if (last.type === 'function_call_output') return answer(result(request).needsClarification ? 'Which Moodle review do you mean?' : 'Completed the Moodle review you selected.');
    if ((last.content as string).startsWith('I mean')) { const task = request.context.recentTasks.find(task => task.title === 'Moodle review two')!; return call('complete_task', { taskId: task.id, expectedRevision: task.revision, outcome: null }); }
    return call('search_tasks', { query: 'Moodle', includeCompleted: false, includeDeleted: false, limit: 20 });
  });
  await page.goto('/#today'); await manualTask(page, 'Moodle review one'); await manualTask(page, 'Moodle review two'); await page.getByRole('link', { name: 'Assistant', exact: true }).click();
  await send(page, 'Finish the Moodle review.'); await expect(page.getByRole('log')).toContainText('Which Moodle review');
  await expect(page.getByRole('button', { name: 'Moodle review two', exact: true })).toBeVisible();
  await send(page, 'I mean Moodle review two.'); await expect(page.getByRole('log')).toContainText('Completed the Moodle review you selected');
  await page.getByRole('link', { name: /^Today/ }).click();
  await expect(page.getByRole('button', { name: 'Open Moodle review one', exact: true })).toBeVisible(); await expect(page.getByRole('button', { name: 'Open Moodle review two', exact: true })).toHaveCount(0);
});

test('a project and its linked task remain after the conversation is cleared', async ({ page }) => {
  await model(page, request => {
    if (request.input.at(-1)!.type !== 'function_call_output') return call('create_project', { name: 'Launchpad', notes: 'Programme launch and marketing context.', workstream: 'Projects', dueDate: null });
    const output = result(request);
    if (output.name === 'create_project') return call('create_task', createArgs({ title: 'Email Marketing about Launchpad', workstream: 'Projects', projectId: (output.data as Project).id, notes: 'Can wait until next week.', dueDate: nextMonday(request.context.today) }));
    return answer('Created Launchpad and scheduled the Marketing task for next Monday.');
  });
  await page.goto('/'); await send(page, 'Create a Launchpad project and add emailing Marketing next week.'); await expect(page.getByRole('log')).toContainText('Created Launchpad and scheduled');
  await page.getByRole('button', { name: 'New conversation', exact: true }).click(); await page.getByRole('link', { name: 'Projects', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Launchpad', exact: true })).toBeVisible(); await expect(page.getByText('Programme launch and marketing context.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View tasks', exact: true }).click(); await expect(page.getByRole('button', { name: 'Open Email Marketing about Launchpad', exact: true })).toBeVisible();
  await page.reload(); await page.getByRole('link', { name: 'Projects', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Launchpad', exact: true })).toBeVisible();
});

test('a failed final AI response can be resumed after reload without duplicate database actions', async ({ page }) => {
  let requests = 0;
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: true } }));
  await page.route('**/api/assistant/chat', async route => {
    requests++;
    if (requests === 1) await route.fulfill({ json: call('create_task', createArgs({ title: 'Recover this task once' })) });
    else if (requests === 2) await route.fulfill({ status: 502, json: { error: 'The model connection was interrupted.' } });
    else await route.fulfill({ json: answer('Your task is saved once, with its context.') });
  });
  await page.goto('/'); await send(page, 'Add a task to recover once.'); await expect(page.getByRole('alert')).toContainText('interrupted'); await expect(page.getByRole('log')).toContainText('Added “Recover this task once”');
  await page.reload(); await page.getByRole('button', { name: 'Resume request', exact: true }).click(); await expect(page.getByRole('log')).toContainText('saved once');
  await page.getByRole('link', { name: /^All Tasks/ }).click(); await page.getByLabel('Search tasks', { exact: true }).fill('Recover this task once'); await expect(page.getByRole('button', { name: 'Open Recover this task once', exact: true })).toHaveCount(1);
});

test('workload answers read the actual database and the mobile assistant is accessible', async ({ page }) => {
  await model(page, request => request.input.at(-1)!.type !== 'function_call_output' ? call('get_today_tasks', {}) : answer(`You have ${result(request).data.focus.length} chosen focus tasks. Start with the assessment wording, then the handbook corrections.`));
  await page.goto('/'); await send(page, 'What do I actually need to get done today?'); await expect(page.getByRole('log')).toContainText('3 chosen focus tasks');
  await page.screenshot({ path: 'test-results/assistant-desktop.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))).toEqual([]);
  await page.screenshot({ path: 'test-results/assistant-mobile.png', fullPage: true });
});

test('no external ChatGPT workflow is offered when the assistant is not configured', async ({ page }) => {
  await page.route('**/api/assistant/status', route => route.fulfill({ json: { ready: false } })); await page.goto('/');
  await expect(page.getByText('The secure assistant isn’t connected yet', { exact: true })).toBeVisible(); await page.getByLabel('Message your assistant', { exact: true }).fill('Keep this draft while I connect.');
  await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled(); await expect(page.getByRole('link', { name: 'Open ChatGPT' })).toHaveCount(0); await expect(page.getByRole('button', { name: 'Copy prompt for ChatGPT' })).toHaveCount(0);
});

test('dictation is explicit and keeps multiple final speech segments', async ({ page }) => {
  await model(page, () => answer('Ready.'));
  await page.addInitScript(() => {
    class Recognition {
      onstart?: () => void; onresult?: (event: unknown) => void; onend?: () => void;
      start() { this.onstart?.(); this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: 'Vittoria wants me to check with Prakash.' } }, { isFinal: true, 0: { transcript: 'Before doing anything else.' } }] }); }
      stop() { this.onend?.(); } abort() { this.onend?.(); }
    }
    Object.assign(window, { SpeechRecognition: Recognition });
  });
  await page.goto('/'); await expect(page.getByLabel('Message your assistant', { exact: true })).toHaveValue(''); await page.getByRole('button', { name: 'Start dictation', exact: true }).click();
  await expect(page.getByLabel('Message your assistant', { exact: true })).toHaveValue('Vittoria wants me to check with Prakash. Before doing anything else.'); await page.getByRole('button', { name: 'Stop dictation', exact: true }).click();
});

test('contextual assistant keeps the workstream open and hosted sign-in keeps the note', async ({ page }) => {
  let allowed = false;
  await page.route('**/api/assistant/status', route => route.fulfill({ status: allowed ? 200 : 401, json: { ready: allowed } })); await page.goto('/#workstreams');
  await page.getByRole('button', { name: 'Talk to assistant in Regulatory & Quality', exact: true }).click(); const panel = page.getByRole('dialog', { name: 'Your management assistant', exact: true });
  await panel.getByLabel('Message your assistant', { exact: true }).fill('Keep my QA context.'); await expect(panel.getByRole('link', { name: 'Sign in to Work Hub' })).toHaveAttribute('target', '_blank');
  allowed = true; await panel.getByRole('button', { name: 'Check connection', exact: true }).click(); await expect(panel.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Close assistant', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Workstreams', exact: true })).toBeVisible();
});

test('workspace backup retains task records and omits conversation/provider credentials', async ({ page }) => {
  await model(page, request => request.input.at(-1)!.type !== 'function_call_output' ? call('create_task', createArgs({ title: 'Back up this record' })) : answer('Saved your task.'));
  await page.goto('/'); await send(page, 'Create the backup example.'); await expect(page.getByRole('log')).toContainText('Saved your task.');
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const pending = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download workspace backup', exact: true }).click();
  const download = await pending; const path = await download.path();
  const backup = JSON.parse(await readFile(path!, 'utf8'));
  expect(backup.tasks).toEqual(expect.arrayContaining([expect.objectContaining({ title: 'Back up this record', provider: 'local' })]));
  expect(backup.version).toBe(2); expect(backup).not.toHaveProperty('conversation'); expect(backup).not.toHaveProperty('receipts');
});
