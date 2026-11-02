import { describe, it, expect } from 'vitest';
import { WorkspaceProvider } from '../src/providers/WorkspaceProvider';
import type { WorkspaceSnapshot, WorkspaceStorage } from '../src/providers/storage';

class Storage implements WorkspaceStorage {
  state?: WorkspaceSnapshot;
  fail = false;
  async read() { return this.state && structuredClone(this.state); }
  async write(state: WorkspaceSnapshot) { if (this.fail) throw new Error('Storage full'); this.state = structuredClone(state); }
}
describe('daily notebook persistence', () => {
  it('keeps dated notes separate from tasks, conversations and later task writes', async () => {
    const storage = new Storage(); const workspace = new WorkspaceProvider(storage);
    const tasks = await workspace.list();
    await Promise.all([workspace.saveDailyNote('2026-11-02', 'Meeting notes\nWaiting for the revised plan.'), workspace.saveDailyNote('2026-11-01', 'Yesterday’s work')]);
    await workspace.create('Review draft');
    const reloaded = new WorkspaceProvider(storage);
    expect((await reloaded.snapshot()).dailyNotes).toEqual({ '2026-11-02': 'Meeting notes\nWaiting for the revised plan.', '2026-11-01': 'Yesterday’s work' });
    expect((await reloaded.list()).length).toBe(tasks.length + 1);
    await reloaded.saveDailyNote('2026-11-02', 'Updated');
    await reloaded.saveDailyNote('2026-11-01', '');
    expect((await reloaded.snapshot()).dailyNotes).toEqual({ '2026-11-02': 'Updated' });
  });
  it('retains the saved note on write failure and allows retry', async () => {
    const storage = new Storage(); const workspace = new WorkspaceProvider(storage);
    await workspace.saveDailyNote('2026-11-02', 'Original'); storage.fail = true;
    await expect(workspace.saveDailyNote('2026-11-02', 'New text')).rejects.toThrow('Storage full');
    expect(storage.state?.dailyNotes?.['2026-11-02']).toBe('Original');
    storage.fail = false; await workspace.saveDailyNote('2026-11-02', 'New text');
    expect((await workspace.snapshot()).dailyNotes?.['2026-11-02']).toBe('New text');
  });
  it('validates note dates and includes notes in an explicit workspace reset', async () => {
    const workspace = new WorkspaceProvider(new Storage());
    await expect(workspace.saveDailyNote('2026-02-30', 'Bad date')).rejects.toThrow();
    await workspace.saveDailyNote('2026-11-02', 'Sample'); await workspace.reset();
    expect((await workspace.snapshot()).dailyNotes).toEqual({});
  });
});
