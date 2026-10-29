export type ProviderId = 'mock' | 'todo' | 'planner';
export type TaskStatus = 'notStarted' | 'inProgress' | 'waiting' | 'completed';
export type Priority = 'low' | 'normal' | 'high' | 'critical';
export type SourceType = 'Manual' | 'To Do' | 'Outlook' | 'Planner' | 'Teams';
export interface ChecklistItem { id: string; title: string; completed: boolean }
export interface Resource { id: string; title: string; url: string }
export interface Task {
  id: string;
  provider: ProviderId;
  providerTaskId: string;
  providerListId?: string;
  etag?: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: Priority;
  dueDate: string | null;
  createdAt: string;
  completedAt: string | null;
  workstream: string;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl?: string;
  checklist: ChecklistItem[];
  resources: Resource[];
  waitingFor: string;
  followUpDate: string | null;
  completionNote: string;
  // A local presentation date, not a Planner beta My Day field.
  focusDate: string | null;
}
export type TaskPatch = Partial<Omit<Task, 'id' | 'provider' | 'providerTaskId' | 'providerListId' | 'etag' | 'createdAt' | 'sourceType' | 'sourceName' | 'sourceUrl'>>;
export type TaskField = keyof TaskPatch;
export interface ProviderCapabilities {
  create: boolean;
  writableFields: readonly TaskField[];
  requiresConnection: boolean;
}
export interface TaskProvider {
  readonly id: ProviderId;
  readonly capabilities: ProviderCapabilities;
  list(): Promise<Task[]>;
  create(title: string, workstream?: string): Promise<Task>;
  capture?(drafts: TaskDraft[]): Promise<Task[]>;
  update(task: Task, patch: TaskPatch): Promise<Task>;
}
export interface TaskDraft {
  title: string;
  notes: string;
  workstream: string;
  status: Exclude<TaskStatus, 'completed'>;
  priority: Priority;
  dueDate: string | null;
  waitingFor: string;
  followUpDate: string | null;
  checklist: string[];
  focusToday: boolean;
}
export const workstreamDefaults = [
  'Programme Delivery', 'Assessment & Content', 'Regulatory & Quality',
  'LMS / Digital', 'Providers & Stakeholders', 'Projects', 'Ideas / Improvements'
];
export const statusLabels: Record<TaskStatus, string> = {
  notStarted: 'Not started', inProgress: 'In progress', waiting: 'Waiting', completed: 'Completed'
};
export const priorityLabels: Record<Priority, string> = { low: 'Low', normal: 'Normal', high: 'High', critical: 'Critical' };
export const sourceTypes: SourceType[] = ['Manual', 'To Do', 'Outlook', 'Planner', 'Teams'];
export function searchableText(task: Task): string {
  return [task.title, task.notes, task.completionNote, task.waitingFor, task.workstream,
    task.sourceName, ...task.checklist.map(i => i.title), ...task.resources.map(r => r.title)].join(' ').toLocaleLowerCase();
}
export function safeUrl(url: string): string | undefined {
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined; }
  catch { return undefined; }
}
