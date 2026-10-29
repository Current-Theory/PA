import { describe, expect, it } from 'vitest';
import { MockTaskProvider } from '../src/providers/MockTaskProvider';
import { TaskHub } from '../src/providers/TaskHub';
import type { WorkspaceSnapshot, WorkspaceStorage } from '../src/providers/storage';
import type { Task, TaskProvider } from '../src/lib/model';
import { searchableText, safeUrl } from '../src/lib/model';
import { upcomingGroup, addDays } from '../src/lib/dates';

class MemoryStorage implements WorkspaceStorage {
  snapshot?: WorkspaceSnapshot;
  fail = false;
  async read() { return this.snapshot ? structuredClone(this.snapshot) : undefined; }
  async write(snapshot: WorkspaceSnapshot) { if (this.fail) throw new Error('disk full'); this.snapshot = structuredClone(snapshot); }
}
const setup = () => { const storage = new MemoryStorage(); return { storage, provider: new MockTaskProvider(storage, '2026-10-29') }; };

describe('demo workflow', () => {
  it('captures, persists, completes with context and reopens without duplicating', async () => {
    const { storage, provider } = setup();
    const task = await provider.create('  Review release  ');
    expect(task.title).toBe('Review release');
    const updated = await provider.update(task, { notes: 'Context stays', completionNote: 'Approved', status: 'completed', checklist: [{ id: '1', title: 'Review', completed: true }] });
    expect(updated.completedAt).toBeTruthy();
    const restored = new MockTaskProvider(storage);
    expect((await restored.list()).find(t => t.id === task.id)).toMatchObject({ notes: 'Context stays', completionNote: 'Approved', status: 'completed' });
    const reopened = await restored.update(updated, { status: 'inProgress' });
    expect(reopened.completedAt).toBeNull();
    expect((await restored.list()).filter(t => t.providerTaskId === task.providerTaskId)).toHaveLength(1);
  });
  it('does not claim a mutation succeeded when durable storage fails', async () => {
    const { storage, provider } = setup();
    const task = (await provider.list())[0]; storage.fail = true;
    await expect(provider.update(task, { title: 'Lost update' })).rejects.toThrow('disk full');
    expect((await provider.list())[0].title).toBe(task.title);
    storage.fail = false;
    await provider.update(task, { title: 'Saved update' });
    expect((await provider.list())[0].title).toBe('Saved update');
  });
  it('serializes simultaneous writes without dropping tasks', async () => {
    const { provider } = setup();
    const tasks = await Promise.all(['A', 'B', 'C'].map(title => provider.create(title)));
    const stored = await provider.list();
    for (const task of tasks) expect(stored.filter(t => t.id === task.id)).toHaveLength(1);
  });
  it('renames workstreams on completed and active tasks and protects used workstreams', async () => {
    const { provider } = setup();
    await provider.renameWorkstream('Assessment & Content', 'Content');
    expect((await provider.list()).some(t => t.workstream === 'Assessment & Content')).toBe(false);
    expect((await provider.list()).find(t => t.id === 'sample-11')?.workstream).toBe('Content');
    await expect(provider.removeWorkstream('Content')).rejects.toThrow('Move all tasks');
    await expect(provider.addWorkstream('content')).rejects.toThrow('already exists');
  });
  it('retains waiting and historical fields in full text search', async () => {
    const { provider } = setup();
    const tasks = await provider.list();
    expect(searchableText(tasks.find(t => t.id === 'sample-6')!)).toContain('provider support team');
    expect(searchableText(tasks.find(t => t.id === 'sample-11')!)).toContain('agreed the review sequence');
    await expect(provider.create('   ')).rejects.toThrow('title');
  });
});

describe('canonical provider routing', () => {
  it('updates the original provider ID and refuses unsupported fields before sending', async () => {
    const { provider } = setup();
    const original: Task = { ...(await provider.list())[0], id: 'todo:list:canonical', provider: 'todo', providerTaskId: 'canonical', providerListId: 'list' };
    const updates: Task[] = [];
    const live: TaskProvider = {
      id: 'todo', capabilities: { create: false, requiresConnection: true, writableFields: ['title', 'status'] },
      async list() { return [original]; }, async create() { throw new Error('disabled'); },
      async update(task, patch) { updates.push(task); return { ...task, ...patch }; }
    };
    const hub = new TaskHub([provider, live]);
    await hub.update(original, { title: 'Updated title' });
    expect(updates[0].providerTaskId).toBe('canonical');
    expect(() => hub.update(original, { waitingFor: 'Team' })).toThrow('No changes were sent');
    expect(updates).toHaveLength(1);
    expect((await provider.list()).some(t => t.providerTaskId === 'canonical')).toBe(false);
  });
});

describe('calendar dates and resource security', () => {
  it('groups dates across Sunday and month boundaries by calendar week', () => {
    expect(upcomingGroup('2026-11-02', '2026-11-01')).toBe('Tomorrow');
    expect(upcomingGroup('2026-11-03', '2026-11-01')).toBe('Next week');
    expect(upcomingGroup('2026-11-09', '2026-11-01')).toBe('Later');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('rejects executable, relative and malformed resource URLs', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,<script>')).toBeUndefined();
    expect(safeUrl('/local')).toBeUndefined();
    expect(safeUrl('https://example.com/doc')).toBe('https://example.com/doc');
  });
});
