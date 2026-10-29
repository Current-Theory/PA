import type { Task, TaskPatch, TaskProvider, ProviderCapabilities } from '../lib/model';
import type { GraphClient } from '../lib/microsoft';

export class IntegrationNotImplementedError extends Error {
  constructor(provider: string) {
    super(`${provider} is an integration scaffold. Live task reads and writes are not implemented; the demo has not connected to Microsoft 365.`);
  }
}

// Fail closed. No mock data is ever presented as live Microsoft data.
export class MicrosoftTodoProvider implements TaskProvider {
  readonly id = 'todo' as const;
  readonly capabilities: ProviderCapabilities = { create: false, requiresConnection: true, writableFields: [] };
  constructor(readonly graph: GraphClient) {}
  async list(): Promise<Task[]> { throw new IntegrationNotImplementedError('Microsoft To Do'); }
  async create(_title: string): Promise<Task> { void _title; throw new IntegrationNotImplementedError('Microsoft To Do'); }
  async update(_task: Task, _patch: TaskPatch): Promise<Task> { void _task; void _patch; throw new IntegrationNotImplementedError('Microsoft To Do'); }
}

export class MicrosoftPlannerProvider implements TaskProvider {
  readonly id = 'planner' as const;
  readonly capabilities: ProviderCapabilities = { create: false, requiresConnection: true, writableFields: [] };
  constructor(readonly graph: GraphClient) {}
  async list(): Promise<Task[]> { throw new IntegrationNotImplementedError('Microsoft Planner'); }
  async create(_title: string): Promise<Task> { void _title; throw new IntegrationNotImplementedError('Microsoft Planner'); }
  async update(_task: Task, _patch: TaskPatch): Promise<Task> { void _task; void _patch; throw new IntegrationNotImplementedError('Microsoft Planner'); }
}
