import { describe, it, expect } from 'vitest';
import { buildChatGptPrompt, parseTaskSuggestions, validateCaptureRequest, validCalendarDate } from '../src/lib/capture';
import { MockTaskProvider } from '../src/providers/MockTaskProvider';
import { TaskHub } from '../src/providers/TaskHub';
import type { WorkspaceSnapshot, WorkspaceStorage } from '../src/providers/storage';
import { dateKey } from '../src/lib/dates';

const names = ['Projects', 'Regulatory & Quality'];
const draft = { title: 'Quality-assure the new EarnLearn package', notes: 'Requested by Victoria.', workstream: 'Regulatory & Quality', status: 'notStarted', priority: 'normal', dueDate: null, waitingFor: '', followUpDate: null, checklist: ['Review the design', 'Record quality findings'], focusToday: true };

describe('assisted capture proposals', () => {
  it('imports fenced ChatGPT JSON without inventing dates, status or assignment', () => {
    const proposal = parseTaskSuggestions('```json\n' + JSON.stringify({ tasks: [draft] }) + '\n```', names, 'Projects');
    expect(proposal.tasks[0]).toMatchObject({ title: draft.title, dueDate: null, status: 'notStarted', workstream: 'Regulatory & Quality', focusToday: true });
    expect(proposal.tasks[0].notes).toContain('Victoria');
    expect(proposal.tasks[0].checklist).toHaveLength(2);
  });
  it('keeps a clear warning when an assistant suggests an unknown workstream', () => {
    const proposal = parseTaskSuggestions({ tasks: [{ ...draft, workstream: 'Unconfigured' }] }, names, 'Projects');
    expect(proposal.tasks[0].workstream).toBe('Projects');
    expect(proposal.warnings[0]).toContain('not configured');
  });
  it('rejects malformed JSON, invalid dates, automatic completion and identity fields', () => {
    expect(() => parseTaskSuggestions('Here are your tasks', names, 'Projects')).toThrow('JSON');
    for (const changed of [{ dueDate: '2026-02-30' }, { status: 'completed' }, { focusToday: 'yes' }, { providerTaskId: 'replace-a-task' }]) {
      expect(() => parseTaskSuggestions({ tasks: [{ ...draft, ...changed }] }, names, 'Projects')).toThrow();
    }
    expect(validCalendarDate('2028-02-29')).toBe(true);
  });
  it('includes the selected context and schema without including any existing tasks', () => {
    const request = validateCaptureRequest({ note: 'Victoria requested a QA review', workstream: 'Projects', workstreams: names, today: '2026-10-30' });
    const prompt = buildChatGptPrompt(request);
    expect(prompt).toContain('Selected workstream: Projects');
    expect(prompt).toContain('2026-10-30');
    expect(prompt).toContain('Never invent a deadline');
    expect(() => validateCaptureRequest({ ...request, workstream: 'Missing' })).toThrow('configured');
  });
});

class Storage implements WorkspaceStorage {
  state?: WorkspaceSnapshot;
  fail = false;
  async read() { return this.state; }
  async write(state: WorkspaceSnapshot) { if (this.fail) throw new Error('storage full'); this.state = structuredClone(state); }
}

describe('reviewed batch capture', () => {
  it('saves complete drafts atomically and puts selected tasks into Today', async () => {
    const storage = new Storage(), provider = new MockTaskProvider(storage);
    const hub = new TaskHub([provider]);
    const tasks = parseTaskSuggestions({ tasks: [draft, { ...draft, title: 'Design the package', workstream: 'Projects', focusToday: false }] }, names, 'Projects').tasks;
    const created = await hub.capture(tasks);
    expect(created).toHaveLength(2);
    expect(created[0]).toMatchObject({ focusDate: dateKey(), workstream: 'Regulatory & Quality', notes: draft.notes });
    expect(created[1].focusDate).toBeNull();
    expect(created[0].checklist.every(step => step.id && !step.completed)).toBe(true);
    expect(created[0].providerTaskId).toBe(created[0].id);
    expect((await new MockTaskProvider(storage).list()).some(task => task.id === created[0].id)).toBe(true);
  });
  it('creates nothing when one draft is invalid or durable storage fails', async () => {
    const storage = new Storage(), provider = new MockTaskProvider(storage);
    const before = await provider.list();
    const tasks = parseTaskSuggestions({ tasks: [draft] }, names, 'Projects').tasks;
    await expect(provider.capture([tasks[0], { ...tasks[0], title: '' }])).rejects.toThrow('title');
    expect(await provider.list()).toEqual(before);
    storage.fail = true;
    await expect(provider.capture(tasks)).rejects.toThrow('storage full');
    expect(await provider.list()).toEqual(before);
  });
});
