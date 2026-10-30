import { dateKey } from '../lib/dates';
import type { Conversation } from '../assistant/contracts';
import type { Task } from '../lib/model';
import type { WorkspaceSnapshot, WorkspaceStorage } from './storage';
import { DemoStorage } from './storage';
import { MockTaskProvider } from './MockTaskProvider';

// Reuses the existing database, IDs and queued durable writes. The application
// workspace, not conversation text or a model response, owns task/project state.
export class WorkspaceProvider extends MockTaskProvider {
  constructor(storage: WorkspaceStorage = new DemoStorage(), today = dateKey()) { super(storage, today, 'local'); }
  async snapshot(): Promise<WorkspaceSnapshot> { await this.list(); return structuredClone(await this.load()); }
  async conversation(): Promise<Conversation> { return structuredClone((await this.snapshot()).conversation ?? { messages: [], recentTaskIds: [], recentProjectIds: [] }); }
  async saveConversation(conversation: Conversation): Promise<void> { await this.mutate(state => { state.conversation = structuredClone(conversation); }); }
  async transact<T>(key: string, fingerprint: string, fn: (state: WorkspaceSnapshot) => T): Promise<T> {
    return this.mutate(state => {
      state.receipts ??= {};
      const previous = state.receipts[key];
      if (previous) {
        if (previous.fingerprint !== fingerprint) throw new Error('This action was retried with different details. Nothing was changed.');
        return previous.result as T;
      }
      const prefix = key.slice(0, key.indexOf(':') + 1);
      const repeated = Object.entries(state.receipts).find(([id, receipt]) => id.startsWith(prefix) && receipt.fingerprint === fingerprint);
      if (repeated) { state.receipts[key] = structuredClone(repeated[1]); return repeated[1].result as T; }
      const result = fn(state);
      state.receipts[key] = { fingerprint, result: structuredClone(result) };
      return result;
    });
  }
  async restoreTask(id: string): Promise<void> {
    await this.mutate(state => {
      const task = state.tasks.find(task => task.id === id);
      if (!task) throw new Error('Task not found.');
      task.deletedAt = null; task.revision = (task.revision ?? 0) + 1; task.updatedAt = new Date().toISOString();
    });
  }
  async trashTask(task: Task): Promise<void> {
    await this.mutate(state => {
      const current = state.tasks.find(item => item.id === task.id);
      if (!current || current.provider !== 'local') throw new Error('This task cannot be removed from the local workspace.');
      if (current.revision !== task.revision) throw new Error('The task changed. Reopen its details before removing it.');
      const now = new Date().toISOString(); current.deletedAt = now; current.updatedAt = now; current.revision = (current.revision ?? 1) + 1;
      state.events ??= []; state.events.push({ id: crypto.randomUUID(), at: now, action: 'manual_delete_task', taskId: current.id, summary: `Moved “${current.title}” to Trash.` });
    });
  }
}
