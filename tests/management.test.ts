import { describe, expect, it } from 'vitest';
import { WorkspaceProvider } from '../src/providers/WorkspaceProvider';
import type { WorkspaceSnapshot, WorkspaceStorage } from '../src/providers/storage';
import { workstreamDefaults, type Project, type Task } from '../src/lib/model';
import { seedTasks } from '../src/providers/seed';
import { ActionRuntime } from '../src/assistant/runtime';
import { AssistantEngine, type AssistantTransport } from '../src/assistant/engine';
import type { FunctionCall, PendingTurn, ChatResponse } from '../src/assistant/contracts';

class Storage implements WorkspaceStorage {
  state?: WorkspaceSnapshot;
  fail = false;
  failCheckpoint = false;
  async read() { return this.state ? structuredClone(this.state) : undefined; }
  async write(state: WorkspaceSnapshot) {
    if (this.fail) throw new Error('Storage unavailable');
    if (this.failCheckpoint && state.conversation?.pending?.nextCall === 1) { this.failCheckpoint = false; throw new Error('Checkpoint interrupted'); }
    this.state = structuredClone(state);
  }
}
const call = (name: string, args: unknown, callId: string = crypto.randomUUID()): FunctionCall => ({ type: 'function_call', name, call_id: callId, arguments: JSON.stringify(args) });
const turn = (): PendingTurn => ({ id: crypto.randomUUID(), userMessageId: crypto.randomUUID(), input: [], step: 0, results: [], knownTaskIds: [], knownProjectIds: [], ambiguousIds: [] });
const create = (overrides: Record<string, unknown> = {}) => ({ title: 'Review Moodle capstone questions', notes: 'Before the meeting with Vittoria; exact meeting time still unknown.', workstream: 'Assessment & Content', dueDate: '2026-11-02', priority: 'low', status: 'notStarted', waitingFor: null, followUpDate: null, projectId: null, checklist: ['Review questions', 'Record findings'], focusToday: false, ...overrides });
const update = (task: Task, overrides: Record<string, unknown>) => ({ taskId: task.id, expectedRevision: task.revision, title: null, notes: null, status: null, priority: null, workstream: null, waitingFor: null, followUpDate: null, clearFollowUpDate: false, focusToday: null, ...overrides });
const setup = () => {
  const storage = new Storage(), workspace = new WorkspaceProvider(storage, '2026-10-30');
  const pending = turn(), runtime = new ActionRuntime(workspace, pending, '2026-10-30', 'Programme Delivery');
  return { storage, workspace, pending, runtime };
};
const modelCalls = (...calls: FunctionCall[]): ChatResponse => ({ output: calls.map(item => ({ ...item })), calls, text: '' });
const modelText = (text: string): ChatResponse => ({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }], calls: [], text });

describe('workspace evolution and controlled actions', () => {
  it('preserves legacy IDs, context and completions while evolving the saved snapshot', async () => {
    const storage = new Storage();
    storage.state = { tasks: seedTasks('2026-10-30'), workstreams: [...workstreamDefaults] };
    const before = structuredClone(storage.state.tasks);
    const workspace = new WorkspaceProvider(storage);
    const after = await workspace.list();
    expect(after.map(task => task.id)).toEqual(before.map(task => task.id));
    expect(after[0]).toMatchObject({ provider: 'local', providerTaskId: before[0].providerTaskId, notes: before[0].notes, revision: 1 });
    expect(after.find(task => task.status === 'completed')?.completionNote).toBe(before.find(task => task.status === 'completed')?.completionNote);
    await workspace.saveConversation({ messages: [], recentTaskIds: [], recentProjectIds: [] });
    expect(storage.state?.version).toBe(2);
    expect(storage.state?.tasks).toHaveLength(before.length);
  });
  it('executes the complete task lifecycle through validated tools and retains historical context', async () => {
    const { runtime, workspace } = setup();
    let result = await runtime.execute(call('create_task', create()));
    expect(result.ok).toBe(true);
    let task = result.data as Task;
    expect(task).toMatchObject({ priority: 'low', dueDate: '2026-11-02', focusDate: null });
    result = await runtime.execute(call('reschedule_task', { taskId: task.id, expectedRevision: task.revision, dueDate: '2026-11-03' })); task = result.data as Task;
    result = await runtime.execute(call('set_task_priority', { taskId: task.id, expectedRevision: task.revision, priority: 'normal' })); task = result.data as Task;
    result = await runtime.execute(call('add_task_note', { taskId: task.id, expectedRevision: task.revision, note: 'Check with Prakash before proceeding.' })); task = result.data as Task;
    result = await runtime.execute(call('update_task', update(task, { status: 'waiting', waitingFor: 'Prakash', followUpDate: '2026-10-30' }))); task = result.data as Task;
    expect((await runtime.execute(call('get_waiting_tasks', {}))).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: task.id, waitingFor: 'Prakash' })]));
    expect((await runtime.execute(call('get_today_tasks', {}))).data).toMatchObject({ followUp: expect.arrayContaining([expect.objectContaining({ id: task.id })]) });
    result = await runtime.execute(call('complete_task', { taskId: task.id, expectedRevision: task.revision, outcome: 'Review completed; findings recorded.' })); task = result.data as Task;
    expect(task.status).toBe('completed'); const completedAt = task.completedAt;
    expect((await runtime.execute(call('get_completed_tasks', { query: 'findings', limit: 20 }))).data).toEqual(expect.arrayContaining([expect.objectContaining({ id: task.id })]));
    result = await runtime.execute(call('delete_task', { taskId: task.id, expectedRevision: task.revision })); task = result.data as Task;
    expect((await workspace.list()).some(item => item.id === task.id)).toBe(false);
    result = await runtime.execute(call('restore_task', { taskId: task.id, expectedRevision: task.revision })); task = result.data as Task;
    expect(task.completedAt).toBe(completedAt);
    result = await runtime.execute(call('reopen_task', { taskId: task.id, expectedRevision: task.revision })); task = result.data as Task;
    expect(task).toMatchObject({ status: 'notStarted', completedAt: null, completionNote: 'Review completed; findings recorded.' });
    expect(task.notes).toContain('Prakash');
    expect((await runtime.execute(call('get_task', { taskId: task.id }))).data).toMatchObject({ id: task.id, checklist: expect.arrayContaining([expect.objectContaining({ title: 'Review questions' })]) });
    expect((await runtime.execute(call('get_upcoming_tasks', { days: 30 }))).ok).toBe(true);
    expect((await runtime.execute(call('get_overdue_tasks', {}))).ok).toBe(true);
  });
  it('persists project context and task assignments independently of the conversation', async () => {
    const { runtime, workspace, storage } = setup();
    let result = await runtime.execute(call('create_project', { name: 'Launchpad', notes: 'Marketing launch context', workstream: 'Projects', dueDate: null }));
    let project = result.data as Project;
    const task = (await runtime.execute(call('create_task', create({ projectId: project.id })))).data as Task;
    expect(task.projectId).toBe(project.id);
    result = await runtime.execute(call('update_project', { projectId: project.id, expectedRevision: project.revision, name: 'Launchpad package', notes: 'Marketing and quality assurance', status: 'active', workstream: null, dueDate: null, clearDueDate: false })); project = result.data as Project;
    expect((await runtime.execute(call('search_projects', { query: 'Launchpad' }))).data).toEqual([project]);
    expect((await runtime.execute(call('get_project_context', { projectId: project.id }))).data).toMatchObject({ project, active: 1 });
    const changed = await runtime.execute(call('assign_task_project', { taskId: task.id, expectedRevision: task.revision, projectId: null }));
    expect(changed.data).toMatchObject({ projectId: null });
    await new AssistantEngine(workspace).newConversation(async () => {});
    const restored = await new WorkspaceProvider(storage).snapshot();
    expect(restored.projects?.[0].notes).toBe('Marketing and quality assurance');
    expect(restored.tasks.find(item => item.id === task.id)?.notes).toContain('Vittoria');
  });
  it('requires clarification for ambiguous references and rejects guessed/stale/unknown targets', async () => {
    const { workspace, runtime, pending } = setup();
    const first = (await runtime.execute(call('create_task', create()))).data as Task;
    await runtime.execute(call('create_task', create({ title: 'Review Moodle navigation' })));
    const search = await runtime.execute(call('search_tasks', { query: 'Moodle', includeCompleted: false, includeDeleted: false, limit: 20 }));
    expect(search.needsClarification).toBe(true);
    expect((await runtime.execute(call('complete_task', { taskId: first.id, expectedRevision: first.revision, outcome: null }))).ok).toBe(false);
    const clarified = turn(); clarified.knownTaskIds = [first.id];
    const next = new ActionRuntime(workspace, clarified, '2026-10-30', 'Programme Delivery');
    await workspace.update(first, { notes: 'A manual change happened.' });
    expect((await next.execute(call('complete_task', { taskId: first.id, expectedRevision: first.revision, outcome: null }))).summary).toContain('changed');
    const latest = (await next.execute(call('get_task', { taskId: first.id }))).data as Task;
    expect((await next.execute(call('complete_task', { taskId: first.id, expectedRevision: latest.revision, outcome: null }))).ok).toBe(true);
    expect(pending.ambiguousIds).toContain(first.id);
    expect((await next.execute(call('complete_task', { taskId: 'invented', expectedRevision: 1, outcome: null }))).ok).toBe(false);
  });
  it('rejects arbitrary fields/tools, invalid dates and duplicate project names before writes', async () => {
    const { runtime, workspace } = setup(); const before = await workspace.list();
    for (const request of [call('exec_sql', { sql: 'DELETE FROM tasks' }), call('create_task', create({ dueDate: '2026-02-30' })), call('create_task', create({ providerTaskId: 'steal-an-id' }))]) expect((await runtime.execute(request)).ok).toBe(false);
    expect(await workspace.list()).toEqual(before);
    const fields = { name: 'Launchpad', notes: null, workstream: 'Projects', dueDate: null };
    expect((await runtime.execute(call('create_project', fields))).ok).toBe(true);
    expect((await runtime.execute(call('create_project', fields))).ok).toBe(true); // same-turn semantic retry uses its receipt
    const another = new ActionRuntime(workspace, turn(), '2026-10-30', 'Projects');
    expect((await another.execute(call('create_project', fields))).ok).toBe(false);
  });
  it('deduplicates transport/model retries and never reports a failed durable write as success', async () => {
    const { runtime, workspace, storage } = setup();
    const request = call('create_task', create());
    storage.fail = true;
    expect((await runtime.execute(request)).ok).toBe(false);
    storage.fail = false;
    const one = await runtime.execute(request), two = await runtime.execute(request), three = await runtime.execute(call('create_task', create()));
    expect(one.taskId).toBe(two.taskId); expect(two.taskId).toBe(three.taskId);
    expect((await workspace.list()).filter(task => task.title === 'Review Moodle capstone questions')).toHaveLength(1);
    expect((await runtime.execute({ ...request, arguments: JSON.stringify(create({ title: 'Different details' })) })).ok).toBe(false);
  });
  it('reads current database state and serializes writers sharing a storage adapter', async () => {
    const storage = new Storage(), a = new WorkspaceProvider(storage), b = new WorkspaceProvider(storage);
    await Promise.all([a.list(), b.list()]);
    await Promise.all([a.create('Concurrent one'), b.create('Concurrent two')]);
    expect((await a.list()).filter(task => task.title.startsWith('Concurrent'))).toHaveLength(2);
    expect((await b.list()).filter(task => task.title.startsWith('Concurrent'))).toHaveLength(2);
  });
});

describe('embedded conversation execution', () => {
  it('retains ordered clarification choices for a natural second-one reply without a form selection', async () => {
    const { workspace } = setup();
    await workspace.create('Moodle option one'); await workspace.create('Moodle option two');
    const transport: AssistantTransport = async request => {
      const last = request.input.at(-1)!;
      if (last.type === 'function_call_output') return modelText(JSON.parse(last.output as string).needsClarification ? 'Which Moodle item do you mean?' : 'Completed the second item.');
      if (last.content === 'The second one.') {
        expect(request.input.at(-2)!.content).toContain('Verified clarification options');
        const chosen = request.context.recentTasks[1];
        return modelCalls(call('complete_task', { taskId: chosen.id, expectedRevision: chosen.revision, outcome: null }));
      }
      return modelCalls(call('search_tasks', { query: 'Moodle option', includeCompleted: false, includeDeleted: false, limit: 20 }));
    };
    const engine = new AssistantEngine(workspace, transport);
    await engine.send('Finish the Moodle option', 'Programme Delivery', async () => {});
    await engine.send('The second one.', 'Programme Delivery', async () => {});
    const matches = (await workspace.list()).filter(task => task.title.startsWith('Moodle option'));
    expect(matches.filter(task => task.status === 'completed')).toHaveLength(1);
  });
  it('runs model function calls against the workspace and returns tool results for a factual confirmation', async () => {
    const { workspace } = setup(); let step = 0;
    const transport: AssistantTransport = async request => {
      step++;
      if (step === 1) { expect(request.input.at(-1)).toMatchObject({ role: 'user', content: 'Review Moodle next week, not urgent' }); return modelCalls(call('create_task', create())); }
      const result = JSON.parse(request.input.at(-1)!.output as string);
      expect(result).toMatchObject({ ok: true, data: { priority: 'low', dueDate: '2026-11-02' } });
      return modelText('Added the Moodle review for Monday, at low priority.');
    };
    await new AssistantEngine(workspace, transport).send('Review Moodle next week, not urgent', 'Programme Delivery', async () => {});
    expect((await workspace.conversation()).messages.at(-1)?.text).toContain('Monday');
    expect((await workspace.list()).some(task => task.title === 'Review Moodle capstone questions')).toBe(true);
  });
  it('resumes after a failed final model request without duplicating the already saved task', async () => {
    const { workspace, storage } = setup(); let step = 0;
    const transport: AssistantTransport = async () => { if (++step === 1) return modelCalls(call('create_task', create())); throw new Error('Network interrupted'); };
    await expect(new AssistantEngine(workspace, transport).send('Review Moodle', 'Programme Delivery', async () => {})).rejects.toThrow('Network');
    expect((await workspace.conversation()).pending?.results[0].ok).toBe(true);
    const restored = new WorkspaceProvider(storage);
    await new AssistantEngine(restored, async () => modelText('The Moodle review is saved.')).resume('Programme Delivery', async () => {});
    expect((await restored.list()).filter(task => task.title === 'Review Moodle capstone questions')).toHaveLength(1);
    expect((await restored.conversation()).pending).toBeUndefined();
  });
  it('replays a committed action receipt after interruption between task write and conversation checkpoint', async () => {
    const { workspace, storage } = setup(); storage.failCheckpoint = true;
    await expect(new AssistantEngine(workspace, async () => modelCalls(call('create_task', create(), 'stable-call'))).send('Review Moodle', 'Programme Delivery', async () => {})).rejects.toThrow('Checkpoint');
    const restored = new WorkspaceProvider(storage);
    await new AssistantEngine(restored, async () => modelText('Saved your review.')).resume('Programme Delivery', async () => {});
    expect((await restored.list()).filter(task => task.title === 'Review Moodle capstone questions')).toHaveLength(1);
    expect((await restored.snapshot()).events?.filter(event => event.action === 'create_task')).toHaveLength(1);
  });
});
