import type { ProviderId, ProviderCapabilities, Task, TaskDraft, TaskPatch, TaskProvider } from '../lib/model';

// The UI calls the hub; updates always go back to the task's canonical provider.
export class TaskHub {
  private providers: Map<ProviderId, TaskProvider>;
  constructor(providers: TaskProvider[], private captureProvider: ProviderId = 'mock') {
    this.providers = new Map(providers.map(p => [p.id, p]));
  }
  provider(id: ProviderId): TaskProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`The ${id} provider is not connected.`);
    return provider;
  }
  capabilities(id: ProviderId): ProviderCapabilities {
    return this.providers.get(id)?.capabilities ?? { create: false, writableFields: [], requiresConnection: true };
  }
  async list(): Promise<Task[]> { return (await Promise.all([...this.providers.values()].map(p => p.list()))).flat(); }
  create(title: string, workstream?: string): Promise<Task> { return this.provider(this.captureProvider).create(title, workstream); }
  capture(drafts: TaskDraft[]): Promise<Task[]> {
    const provider = this.provider(this.captureProvider);
    if (!provider.capabilities.create || !provider.capture) throw new Error('This provider does not support assisted capture yet. No tasks were created.');
    return provider.capture(drafts);
  }
  update(task: Task, patch: TaskPatch): Promise<Task> {
    const provider = this.provider(task.provider);
    const unsupported = Object.keys(patch).filter(k => !provider.capabilities.writableFields.includes(k as keyof TaskPatch));
    if (unsupported.length) throw new Error(`This provider cannot save: ${unsupported.join(', ')}. No changes were sent.`);
    return provider.update(task, patch);
  }
}
