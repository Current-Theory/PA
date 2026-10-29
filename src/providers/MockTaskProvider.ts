import { dateKey } from '../lib/dates';
import { workstreamDefaults, type Task, type TaskPatch, type TaskProvider } from '../lib/model';
import { seedTasks } from './seed';
import { DemoStorage, type WorkspaceStorage, type WorkspaceSnapshot } from './storage';

export class MockTaskProvider implements TaskProvider {
  readonly id = 'mock' as const;
  readonly capabilities = {
    create: true, requiresConnection: false,
    writableFields: ['title', 'notes', 'status', 'priority', 'dueDate', 'completedAt', 'workstream',
      'checklist', 'resources', 'waitingFor', 'followUpDate', 'completionNote', 'focusDate'] as const
  };
  private state?: WorkspaceSnapshot;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: WorkspaceStorage = new DemoStorage(), private today = dateKey()) {}
  private async load(): Promise<WorkspaceSnapshot> {
    if (!this.state) {
      this.state = await this.storage.read() ?? { tasks: seedTasks(this.today), workstreams: [...workstreamDefaults] };
    }
    return this.state;
  }
  private mutate<T>(fn: (state: WorkspaceSnapshot) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const next = structuredClone(await this.load());
      const result = fn(next);
      await this.storage.write(next);
      this.state = next;
      return structuredClone(result);
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  async list(): Promise<Task[]> { await this.queue; return structuredClone((await this.load()).tasks); }
  async workstreams(): Promise<string[]> { await this.queue; return [...(await this.load()).workstreams]; }
  async create(title: string, workstream = 'Programme Delivery'): Promise<Task> {
    if (!title.trim()) throw new Error('Give your task a title.');
    return this.mutate(state => {
      const id = crypto.randomUUID();
      const task: Task = {
        id, provider: this.id, providerTaskId: id, title: title.trim(), notes: '',
        status: 'notStarted', priority: 'normal', dueDate: null, createdAt: new Date().toISOString(),
        completedAt: null, workstream, sourceType: 'Manual', sourceName: 'Quick capture',
        checklist: [], resources: [], waitingFor: '', followUpDate: null,
        completionNote: '', focusDate: dateKey()
      };
      state.tasks.unshift(task); return task;
    });
  }
  async update(task: Task, patch: TaskPatch): Promise<Task> {
    for (const field of Object.keys(patch)) {
      if (!(this.capabilities.writableFields as readonly string[]).includes(field)) throw new Error(`Unsupported field: ${field}`);
    }
    if (patch.title !== undefined && !patch.title.trim()) throw new Error('The task title cannot be empty.');
    return this.mutate(state => {
      const index = state.tasks.findIndex(t => t.id === task.id && t.providerTaskId === task.providerTaskId);
      if (index < 0) throw new Error('This task could not be found. Refresh and try again.');
      const updated = { ...state.tasks[index], ...patch };
      if (patch.title) updated.title = patch.title.trim();
      if (patch.status) updated.completedAt = patch.status === 'completed' ? (updated.completedAt ?? new Date().toISOString()) : null;
      state.tasks[index] = updated; return updated;
    });
  }
  async addWorkstream(name: string): Promise<string[]> {
    return this.mutate(state => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Enter a workstream name.');
      if (state.workstreams.some(w => w.toLowerCase() === trimmed.toLowerCase())) throw new Error('That workstream already exists.');
      state.workstreams.push(trimmed); return state.workstreams;
    });
  }
  async renameWorkstream(from: string, name: string): Promise<string[]> {
    return this.mutate(state => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error('Enter a workstream name.');
      if (state.workstreams.some(w => w !== from && w.toLowerCase() === trimmed.toLowerCase())) throw new Error('That workstream already exists.');
      state.workstreams = state.workstreams.map(w => w === from ? trimmed : w);
      state.tasks = state.tasks.map(t => t.workstream === from ? { ...t, workstream: trimmed } : t);
      return state.workstreams;
    });
  }
  async removeWorkstream(name: string): Promise<string[]> {
    return this.mutate(state => {
      if (state.tasks.some(t => t.workstream === name)) throw new Error('Move all tasks, including completed tasks, to another workstream before removing this one.');
      if (state.workstreams.length === 1) throw new Error('Keep at least one workstream.');
      state.workstreams = state.workstreams.filter(w => w !== name); return state.workstreams;
    });
  }
  async reset(): Promise<void> {
    await this.mutate(state => { state.tasks = seedTasks(dateKey()); state.workstreams = [...workstreamDefaults]; });
  }
}
