import { dateKey } from '../lib/dates';
import { workstreamDefaults, type Task, type TaskDraft, type TaskPatch, type TaskProvider, type ProviderId } from '../lib/model';
import { parseTaskSuggestions } from '../lib/capture';
import { seedTasks } from './seed';
import { DemoStorage, type WorkspaceStorage, type WorkspaceSnapshot } from './storage';
const storageQueues = new WeakMap<WorkspaceStorage, Promise<unknown>>();

export class MockTaskProvider implements TaskProvider {
  readonly capabilities = {
    create: true, requiresConnection: false,
    writableFields: ['title', 'notes', 'status', 'priority', 'dueDate', 'completedAt', 'workstream',
      'checklist', 'resources', 'waitingFor', 'followUpDate', 'completionNote', 'focusDate', 'projectId'] as const
  };
  protected state?: WorkspaceSnapshot;
  private loading?: Promise<WorkspaceSnapshot>;
  private queue: Promise<unknown> = Promise.resolve();
  constructor(private storage: WorkspaceStorage = new DemoStorage(), private today = dateKey(), readonly id: ProviderId = 'mock') {}
  private normalize(state: WorkspaceSnapshot): WorkspaceSnapshot {
    return { ...state, version: 2, projects: state.projects ?? [], receipts: state.receipts ?? {}, events: state.events ?? [],
      tasks: state.tasks.map(task => ({ ...task, provider: this.id === 'local' && task.provider === 'mock' ? 'local' : task.provider, projectId: task.projectId ?? null, revision: task.revision ?? 1, updatedAt: task.updatedAt ?? task.createdAt, deletedAt: task.deletedAt ?? null })) };
  }
  protected async load(fresh = false): Promise<WorkspaceSnapshot> {
    if (fresh && this.id === 'local') {
      const saved = await this.storage.read();
      this.state = this.normalize(saved ?? { tasks: seedTasks(this.today), workstreams: [...workstreamDefaults] });
      return this.state;
    }
    if (this.state) return this.state;
    if (!this.loading) this.loading = (async () => {
      const saved = await this.storage.read();
      const state = saved ?? { tasks: seedTasks(this.today), workstreams: [...workstreamDefaults] };
      const next = this.normalize(state);
      this.state = next; return next;
    })().catch(error => { this.loading = undefined; throw error; });
    return this.loading;
  }
  protected mutate<T>(fn: (state: WorkspaceSnapshot) => T): Promise<T> {
    const operation = this.queue.then(async () => {
      const write = async () => {
        const next = structuredClone(await this.load(this.id === 'local'));
        const result = fn(next);
        await this.storage.write(next);
        this.state = next;
        return structuredClone(result);
      };
      if (this.id === 'local' && typeof navigator !== 'undefined' && navigator.locks) return navigator.locks.request('earnlearn-workspace-write-v2', write);
      if (this.id === 'local') {
        const result = (storageQueues.get(this.storage) ?? Promise.resolve()).then(write);
        storageQueues.set(this.storage, result.catch(() => undefined)); return result;
      }
      return write();
    });
    this.queue = operation.catch(() => undefined);
    return operation;
  }
  async list(): Promise<Task[]> { await this.queue; return structuredClone((await this.load(this.id === 'local')).tasks.filter(task => !task.deletedAt)); }
  async workstreams(): Promise<string[]> { await this.queue; return [...(await this.load(this.id === 'local')).workstreams]; }
  async create(title: string, workstream = 'Programme Delivery'): Promise<Task> {
    if (!title.trim()) throw new Error('Give your task a title.');
    return this.mutate(state => {
      const id = crypto.randomUUID();
      const task: Task = {
        id, provider: this.id, providerTaskId: id, title: title.trim(), notes: '',
        status: 'notStarted', priority: 'normal', dueDate: null, createdAt: new Date().toISOString(),
        completedAt: null, workstream, sourceType: 'Manual', sourceName: 'Quick capture',
        checklist: [], resources: [], waitingFor: '', followUpDate: null,
        completionNote: '', focusDate: dateKey(), projectId: null, revision: 1, updatedAt: new Date().toISOString(), deletedAt: null
      };
      state.tasks.unshift(task); return task;
    });
  }
  async capture(drafts: TaskDraft[]): Promise<Task[]> {
    return this.mutate(state => {
      // Validate the entire batch before writing; failures never leave half an import.
      const proposal = parseTaskSuggestions({ tasks: drafts }, state.workstreams, state.workstreams[0]);
      if (proposal.warnings.length) throw new Error('A selected workstream changed. Recheck the suggestions before importing.');
      const created = proposal.tasks.map((draft): Task => {
        const id = crypto.randomUUID();
        return {
          id, provider: this.id, providerTaskId: id, title: draft.title, notes: draft.notes,
          workstream: draft.workstream, status: draft.status, priority: draft.priority,
          dueDate: draft.dueDate, createdAt: new Date().toISOString(), completedAt: null,
          sourceType: 'Manual', sourceName: 'Conversation',
          checklist: draft.checklist.map(title => ({ id: crypto.randomUUID(), title, completed: false })),
          resources: [], waitingFor: draft.waitingFor, followUpDate: draft.followUpDate,
          completionNote: '', focusDate: draft.focusToday ? dateKey() : null, projectId: null, revision: 1, updatedAt: new Date().toISOString(), deletedAt: null
        };
      });
      state.tasks.unshift(...created); return created;
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
      if (state.tasks[index].deletedAt) throw new Error('This task is in Trash. Restore it before editing.');
      if (task.revision !== undefined && task.revision !== state.tasks[index].revision) throw new Error('This task changed. Reopen its latest details before saving.');
      if (patch.projectId && !state.projects?.some(project => project.id === patch.projectId)) throw new Error('The project could not be found.');
      const updated = { ...state.tasks[index], ...patch };
      updated.revision = (updated.revision ?? 0) + 1; updated.updatedAt = new Date().toISOString();
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
      state.tasks = state.tasks.map(t => t.workstream === from ? { ...t, workstream: trimmed, revision: (t.revision ?? 1) + 1, updatedAt: new Date().toISOString() } : t);
      state.projects = state.projects?.map(project => project.workstream === from ? { ...project, workstream: trimmed, revision: project.revision + 1, updatedAt: new Date().toISOString() } : project);
      return state.workstreams;
    });
  }
  async removeWorkstream(name: string): Promise<string[]> {
    return this.mutate(state => {
      if (state.tasks.some(t => t.workstream === name)) throw new Error('Move all tasks, including completed tasks, to another workstream before removing this one.');
      if (state.projects?.some(project => project.workstream === name)) throw new Error('Move the projects in this workstream before removing it.');
      if (state.workstreams.length === 1) throw new Error('Keep at least one workstream.');
      state.workstreams = state.workstreams.filter(w => w !== name); return state.workstreams;
    });
  }
  async reset(): Promise<void> {
    await this.mutate(state => { state.tasks = seedTasks(dateKey()).map(task => ({ ...task, provider: this.id, revision: 1, projectId: null, deletedAt: null })); state.workstreams = [...workstreamDefaults]; state.projects = []; state.dailyNotes = {}; state.conversation = undefined; state.receipts = {}; state.events = []; });
  }
}
