import { z } from 'zod';
import { validCalendarDate } from '../lib/capture.ts';

const id = z.string().min(1).max(200);
const title = z.string().trim().min(1).max(500);
const text = z.string().max(30000);
const date = z.string().refine(validCalendarDate, 'Use a real YYYY-MM-DD date.');
const priority = z.enum(['low', 'normal', 'high', 'critical']);
const status = z.enum(['notStarted', 'inProgress', 'waiting', 'completed']);
const target = { taskId: id, expectedRevision: z.number().int().min(1) };
const obj = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape);

export const tools = {
  create_task: { description: 'Create one task from the user’s request. Use null for unspecified fields. Do not invent deadlines or urgency. Keep requested context in notes.', schema: obj({ title, notes: text.nullable(), workstream: z.string().max(80).nullable(), dueDate: date.nullable(), priority: priority.nullable(), status: z.enum(['notStarted', 'inProgress', 'waiting']).nullable(), waitingFor: z.string().max(200).nullable(), followUpDate: date.nullable(), projectId: id.nullable(), checklist: z.array(title).max(30), focusToday: z.boolean() }) },
  update_task: { description: 'Update a task already found in this conversation. Null means leave that field unchanged; use reschedule_task to clear a due date. Use the latest revision from a tool result.', schema: obj({ ...target, title: title.nullable(), notes: text.nullable(), status: status.nullable(), priority: priority.nullable(), workstream: z.string().max(80).nullable(), waitingFor: z.string().max(200).nullable(), followUpDate: date.nullable(), clearFollowUpDate: z.boolean(), focusToday: z.boolean().nullable() }) },
  complete_task: { description: 'Complete an unambiguously identified task, retaining notes and history. outcome is optional (null).', schema: obj({ ...target, outcome: text.nullable() }) },
  reopen_task: { description: 'Reopen a completed task or restore a task from Trash, preserving its context.', schema: obj(target) },
  delete_task: { description: 'Move an explicitly requested, unambiguously identified task to recoverable Trash. Never permanently erase data.', schema: obj(target) },
  restore_task: { description: 'Restore a task from Trash without changing its previous active/completed status or completion history.', schema: obj(target) },
  add_task_note: { description: 'Append context to the existing task notes without replacing prior notes.', schema: obj({ ...target, note: z.string().trim().min(1).max(10000) }) },
  reschedule_task: { description: 'Set a task’s due date, or clear it with null. Use the local calendar date supplied in context. Ask if an unknown meeting date matters.', schema: obj({ ...target, dueDate: date.nullable() }) },
  set_task_priority: { description: 'Change an identified task’s priority when requested; use low for explicitly non-urgent work.', schema: obj({ ...target, priority }) },
  assign_task_project: { description: 'Link an identified task to an existing project, or unlink with null. This does not assign a Microsoft user.', schema: obj({ ...target, projectId: id.nullable() }) },
  get_task: { description: 'Get the latest task, notes, checklist and revision by an ID obtained from current context or search. Can retrieve Trash records.', schema: obj({ taskId: id }) },
  search_tasks: { description: 'Find tasks by words in titles/context. If multiple plausible matches are returned, ask the user which one; do not choose arbitrarily.', schema: obj({ query: z.string().trim().min(1).max(500), includeCompleted: z.boolean(), includeDeleted: z.boolean(), limit: z.number().int().min(1).max(25) }) },
  get_today_tasks: { description: 'Read today’s focus, due, overdue and due follow-ups from the database. Use this before answering what to do today or workload questions.', schema: obj({}) },
  get_upcoming_tasks: { description: 'Read future tasks in chronological order. days is the upcoming calendar-day horizon.', schema: obj({ days: z.number().int().min(1).max(90) }) },
  get_overdue_tasks: { description: 'Read incomplete tasks whose due date is before the supplied local date.', schema: obj({}) },
  get_waiting_tasks: { description: 'Read who/what is being waited on, original context and follow-up dates.', schema: obj({}) },
  get_completed_tasks: { description: 'Search the retained historical work log; query null returns recent completions.', schema: obj({ query: z.string().max(500).nullable(), limit: z.number().int().min(1).max(50) }) },
  create_project: { description: 'Create a named project with retained context and a configured workstream. Project names must be distinct.', schema: obj({ name: z.string().trim().min(1).max(150), notes: text.nullable(), workstream: z.string().max(80).nullable(), dueDate: date.nullable() }) },
  update_project: { description: 'Update a project already found in this conversation. Null means leave unchanged. Use the latest project revision.', schema: obj({ projectId: id, expectedRevision: z.number().int().min(1), name: z.string().trim().min(1).max(150).nullable(), notes: text.nullable(), status: z.enum(['active', 'onHold', 'completed']).nullable(), workstream: z.string().max(80).nullable(), dueDate: date.nullable(), clearDueDate: z.boolean() }) },
  get_project_context: { description: 'Read a project, its notes and related active/completed tasks. Resolve project names using search_projects first.', schema: obj({ projectId: id }) },
  search_projects: { description: 'Find projects by name or context. Ask if multiple plausible projects match.', schema: obj({ query: z.string().trim().min(1).max(500) }) }
} as const;
export type ToolName = keyof typeof tools;
export function isToolName(name: string): name is ToolName { return Object.hasOwn(tools, name); }
export const functionTools = Object.entries(tools).map(([name, tool]) => {
  const schema = z.toJSONSchema(tool.schema, { target: 'draft-7' });
  delete schema.$schema;
  return { type: 'function' as const, name, description: tool.description, parameters: schema, strict: true };
});
