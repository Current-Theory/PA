import { describe, it, expect } from 'vitest';
import { WorkspaceProvider } from '../src/providers/WorkspaceProvider';
import type { WorkspaceSnapshot, WorkspaceStorage } from '../src/providers/storage';

class Storage implements WorkspaceStorage {
  state?: WorkspaceSnapshot;
  fail = false;
  async read() { return this.state && structuredClone(this.state); }
  async write(state: WorkspaceSnapshot) { if (this.fail) throw new Error('Storage full'); this.state = structuredClone(state); }
}
const input = { name: '  Deliver the assessment update  ', workstream: 'Programme Delivery', notes: 'Release the approved version.', dueDate: '2026-12-01' };
describe('direct projects use the existing project schema and persistence', () => {
  it('persists a project within an existing workstream, retaining existing tasks and notes', async () => {
    const storage = new Storage(); const workspace = new WorkspaceProvider(storage);
    const before = await workspace.list(); await workspace.saveDailyNote('2026-11-02', 'Daily record');
    const created = await workspace.createProject(input);
    expect(created).toMatchObject({ name: 'Deliver the assessment update', status: 'active', workstream: input.workstream, dueDate: input.dueDate, revision: 1 });
    const snapshot = await new WorkspaceProvider(storage).snapshot();
    expect(snapshot.projects).toEqual([created]); expect(snapshot.tasks).toEqual(before);
    expect(snapshot.dailyNotes?.['2026-11-02']).toBe('Daily record');
    expect(snapshot.events?.at(-1)).toMatchObject({ action: 'manual_create_project', projectId: created.id });
  });
  it('rejects invalid dates, unknown workstreams, empty names and duplicates without partial records', async () => {
    const workspace = new WorkspaceProvider(new Storage()); await workspace.createProject(input);
    for (const patch of [{ name: '' }, { workstream: 'Unknown' }, { dueDate: '2026-02-30' }, { name: 'DELIVER THE ASSESSMENT UPDATE' }]) {
      await expect(workspace.createProject({ ...input, ...patch })).rejects.toThrow();
    }
    expect((await workspace.snapshot()).projects).toHaveLength(1);
  });
  it('rolls back a failed project save and allows a clean retry', async () => {
    const storage = new Storage(); const workspace = new WorkspaceProvider(storage); storage.fail = true;
    await expect(workspace.createProject(input)).rejects.toThrow('Storage full');
    storage.fail = false; await workspace.createProject(input);
    expect((await workspace.snapshot()).projects).toHaveLength(1);
  });
});
