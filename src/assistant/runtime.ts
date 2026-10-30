import { tools, isToolName } from './tools';
import type { ActionResult, FunctionCall, PendingTurn } from './contracts';
import { WorkspaceProvider } from '../providers/WorkspaceProvider';
import { addDays } from '../lib/dates';
import { searchableText, type Task, type Project } from '../lib/model';
import type { WorkspaceSnapshot } from '../providers/storage';

const wordsMatch = (value: string, query: string) => query.toLowerCase().split(/\s+/).filter(Boolean).every(word => value.toLowerCase().includes(word));
const taskView = (task: Task, full = false) => ({ ...task, revision: task.revision ?? 1, notes: task.notes.slice(0, full ? 30000 : 1600), resources: full ? task.resources : [], checklist: full ? task.checklist : [], completionNote: task.completionNote.slice(0, full ? 30000 : 1600) });
const mutations = new Set(['create_task', 'update_task', 'complete_task', 'reopen_task', 'delete_task', 'restore_task', 'add_task_note', 'reschedule_task', 'set_task_priority', 'assign_task_project', 'create_project', 'update_project']);

export class ActionRuntime {
  constructor(private workspace: WorkspaceProvider, readonly turn: PendingTurn, private today: string, private workstream: string) {}
  private seeTasks(tasks: Task[]) { for (const task of tasks) if (!this.turn.knownTaskIds.includes(task.id)) this.turn.knownTaskIds.push(task.id); }
  private seeProjects(projects: Project[]) { for (const project of projects) if (!this.turn.knownProjectIds.includes(project.id)) this.turn.knownProjectIds.push(project.id); }
  async execute(call: FunctionCall): Promise<ActionResult> {
    if (!call || call.type !== 'function_call' || typeof call.call_id !== 'string' || !call.call_id || call.call_id.length > 200 || typeof call.arguments !== 'string' || call.arguments.length > 60000) return { ok: false, name: typeof call?.name === 'string' ? call.name : 'invalid_action', summary: 'Invalid action metadata. Nothing was changed.' };
    if (!isToolName(call.name)) return { ok: false, name: call.name, summary: 'That action is not supported. Nothing was changed.' };
    const name = call.name;
    let args: Record<string, unknown>;
    try { args = tools[name].schema.parse(JSON.parse(call.arguments)) as Record<string, unknown>; }
    catch { return { ok: false, name, summary: `Invalid arguments for ${name}. Nothing was changed; check the requested details.` }; }
    const run = (state: WorkspaceSnapshot): ActionResult => {
      const active = state.tasks.filter(task => !task.deletedAt && task.status !== 'completed');
      const projects = state.projects ??= [];
      const ok = (summary: string, data?: unknown, taskId?: string, projectId?: string): ActionResult => ({ ok: true, name, summary, data, taskId, projectId });
      const fail = (summary: string): ActionResult => ({ ok: false, name, summary });
      const taskId = args.taskId as string | undefined, projectId = args.projectId as string | undefined;
      const task = state.tasks.find(task => task.id === taskId);
      const project = projects.find(project => project.id === projectId);
      const taskList = (list: Task[], label: string) => { this.seeTasks(list); return ok(`${list.length} ${label}.`, list.slice(0, 50).map(task => taskView(task)), list.length === 1 ? list[0].id : undefined); };
      if (name === 'search_tasks') {
        let found = state.tasks.filter(task => (args.includeDeleted || !task.deletedAt) && (args.includeCompleted || task.status !== 'completed') && wordsMatch(searchableText(task), args.query as string));
        const exact = found.filter(task => task.title.toLowerCase() === (args.query as string).toLowerCase());
        if (exact.length === 1) found = exact;
        found.sort((a, b) => (b.title.toLowerCase().includes((args.query as string).toLowerCase()) ? 1 : 0) - (a.title.toLowerCase().includes((args.query as string).toLowerCase()) ? 1 : 0));
        this.seeTasks(found);
        if (found.length > 1) {
          this.turn.ambiguousIds.push(...found.map(task => task.id).filter(id => !this.turn.ambiguousIds.includes(id)));
          return { ...taskList(found.slice(0, args.limit as number), 'matching tasks'), needsClarification: true, candidates: found.slice(0, 10).map(task => ({ id: task.id, title: task.title })) };
        }
        return taskList(found.slice(0, args.limit as number), 'matching tasks');
      }
      if (name === 'get_task') {
        if (!task) return fail('That task was not found. Search the workspace before making changes.');
        this.seeTasks([task]); return ok(`Found “${task.title}”.`, taskView(task, true), task.id);
      }
      if (name === 'get_today_tasks') {
        const focus = active.filter(task => task.focusDate === this.today);
        const due = active.filter(task => task.dueDate === this.today);
        const overdue = active.filter(task => task.dueDate && task.dueDate < this.today);
        const followUp = active.filter(task => task.status === 'waiting' && task.followUpDate && task.followUpDate <= this.today);
        this.seeTasks([...focus, ...due, ...overdue, ...followUp]);
        return ok('Read today’s work from the database.', { today: this.today, focus: focus.map(task => taskView(task)), due: due.map(task => taskView(task)), overdue: overdue.map(task => taskView(task)), followUp: followUp.map(task => taskView(task)), activeCount: active.length });
      }
      if (name === 'get_upcoming_tasks') return taskList(active.filter(task => task.dueDate && task.dueDate > this.today && task.dueDate <= addDays(this.today, args.days as number)).sort((a, b) => a.dueDate!.localeCompare(b.dueDate!)), 'upcoming tasks');
      if (name === 'get_overdue_tasks') return taskList(active.filter(task => task.dueDate && task.dueDate < this.today), 'overdue tasks');
      if (name === 'get_waiting_tasks') return taskList(active.filter(task => task.status === 'waiting'), 'waiting tasks');
      if (name === 'get_completed_tasks') return taskList(state.tasks.filter(task => !task.deletedAt && task.status === 'completed' && (!args.query || wordsMatch(searchableText(task), args.query as string))).sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '')).slice(0, args.limit as number), 'completed tasks');
      if (name === 'search_projects') {
        let found = projects.filter(project => wordsMatch(`${project.name} ${project.notes}`, args.query as string));
        const exact = found.filter(project => project.name.toLowerCase() === (args.query as string).toLowerCase());
        if (exact.length === 1) found = exact;
        this.seeProjects(found);
        if (found.length > 1) this.turn.ambiguousIds.push(...found.map(project => project.id));
        return { ...ok(`${found.length} matching projects.`, found, undefined, found.length === 1 ? found[0].id : undefined), needsClarification: found.length > 1, candidates: found.length > 1 ? found.map(project => ({ id: project.id, title: project.name })) : undefined };
      }
      if (name === 'get_project_context') {
        if (!project) return fail('Project not found. Search projects first.');
        const related = state.tasks.filter(task => !task.deletedAt && task.projectId === project.id);
        this.seeProjects([project]); this.seeTasks(related);
        return ok(`Read context for “${project.name}”.`, { project, tasks: related.map(task => taskView(task)), active: related.filter(task => task.status !== 'completed').length, completed: related.filter(task => task.status === 'completed').length }, undefined, project.id);
      }
      const now = new Date().toISOString();
      if (name === 'create_project') {
        if (projects.some(project => project.name.toLowerCase() === (args.name as string).toLowerCase())) return fail('A project with that name already exists. Search it rather than creating a duplicate.');
        const stream = (args.workstream as string | null) ?? this.workstream;
        if (!state.workstreams.includes(stream)) return fail('Choose a configured workstream for the project.');
        const created: Project = { id: crypto.randomUUID(), name: args.name as string, notes: (args.notes as string | null) ?? '', status: 'active', workstream: stream, dueDate: args.dueDate as string | null, createdAt: now, updatedAt: now, revision: 1 };
        projects.push(created); this.seeProjects([created]);
        return ok(`Created project “${created.name}”.`, created, undefined, created.id);
      }
      if (name === 'update_project') {
        if (!project || !this.turn.knownProjectIds.includes(project.id)) return fail('Find the project before updating it.');
        if (this.turn.ambiguousIds.includes(project.id)) return { ...fail('Several projects matched. Ask which one before updating.'), needsClarification: true };
        if (project.revision !== args.expectedRevision) return fail('The project changed. Read its latest context before retrying.');
        if (args.name && projects.some(item => item.id !== project.id && item.name.toLowerCase() === (args.name as string).toLowerCase())) return fail('Another project already has that name.');
        if (args.workstream && !state.workstreams.includes(args.workstream as string)) return fail('Choose a configured workstream.');
        if (args.clearDueDate && args.dueDate !== null) return fail('Choose whether to set or clear the project date, not both.');
        for (const key of ['name', 'notes', 'status', 'dueDate', 'workstream'] as const) if (args[key] !== null) Object.assign(project, { [key]: args[key] });
        if (args.clearDueDate) project.dueDate = null;
        project.updatedAt = now; project.revision++;
        return ok(`Updated project “${project.name}”.`, project, undefined, project.id);
      }
      if (name === 'create_task') {
        const stream = (args.workstream as string | null) ?? this.workstream;
        if (!state.workstreams.includes(stream)) return fail('Choose a configured workstream. No task was created.');
        if (projectId && (!project || !this.turn.knownProjectIds.includes(projectId) || this.turn.ambiguousIds.includes(projectId))) return fail('Resolve the project before linking a new task to it.');
        const id = crypto.randomUUID();
        const created: Task = { id, provider: 'local', providerTaskId: id, title: args.title as string, notes: (args.notes as string | null) ?? '', status: (args.status as Task['status'] | null) ?? 'notStarted', priority: (args.priority as Task['priority'] | null) ?? 'normal', dueDate: args.dueDate as string | null, createdAt: now, completedAt: null, workstream: stream, sourceType: 'Manual', sourceName: 'Work Hub assistant', checklist: (args.checklist as string[]).map(title => ({ id: crypto.randomUUID(), title, completed: false })), resources: [], waitingFor: (args.waitingFor as string | null) ?? '', followUpDate: args.followUpDate as string | null, completionNote: '', focusDate: args.focusToday ? this.today : null, projectId: projectId ?? null, revision: 1, updatedAt: now, deletedAt: null };
        state.tasks.unshift(created); this.seeTasks([created]);
        return ok(`Added “${created.title}”${created.dueDate ? ` for ${created.dueDate}` : ''}.`, taskView(created, true), created.id);
      }
      if (!task || !this.turn.knownTaskIds.includes(task.id)) return fail('Find the task before changing it. No task was changed.');
      if (this.turn.ambiguousIds.includes(task.id)) return { ...fail('Several tasks matched that reference. Ask which one before making changes.'), needsClarification: true };
      if ((task.revision ?? 1) !== args.expectedRevision) return fail('The task changed. Read its latest details before retrying.');
      if (task.deletedAt && name !== 'reopen_task' && name !== 'restore_task') return fail('This task is in Trash. Restore it before editing.');
      if (task.provider !== 'local') return fail('This source does not yet support assistant edits. No external task was changed.');
      if (name === 'update_task') {
        if (args.workstream && !state.workstreams.includes(args.workstream as string)) return fail('Choose a configured workstream.');
        if (args.clearFollowUpDate && args.followUpDate !== null) return fail('Choose whether to set or clear the follow-up date, not both.');
        for (const key of ['title', 'notes', 'status', 'priority', 'workstream', 'waitingFor', 'followUpDate'] as const) if (args[key] !== null) Object.assign(task, { [key]: args[key] });
        if (args.focusToday !== null) task.focusDate = args.focusToday ? this.today : null;
        if (args.clearFollowUpDate) task.followUpDate = null;
      } else if (name === 'complete_task') { task.status = 'completed'; if (args.outcome !== null) task.completionNote = args.outcome as string; }
      else if (name === 'reopen_task') { task.status = 'notStarted'; task.deletedAt = null; }
      else if (name === 'delete_task') task.deletedAt = now;
      else if (name === 'restore_task') task.deletedAt = null;
      else if (name === 'add_task_note') { if (task.notes.length + (args.note as string).length + 2 > 30000) return fail('The notes are full. Nothing was truncated or changed.'); task.notes = [task.notes, args.note as string].filter(Boolean).join('\n\n'); }
      else if (name === 'reschedule_task') task.dueDate = args.dueDate as string | null;
      else if (name === 'set_task_priority') task.priority = args.priority as Task['priority'];
      else if (name === 'assign_task_project') { if (projectId && (!project || !this.turn.knownProjectIds.includes(projectId) || this.turn.ambiguousIds.includes(projectId))) return fail('Resolve the project before assigning the task.'); task.projectId = projectId ?? null; }
      else return fail('Unsupported action. Nothing was changed.');
      task.completedAt = task.status === 'completed' ? task.completedAt ?? now : null;
      task.revision = (task.revision ?? 1) + 1; task.updatedAt = now;
      const verb = name === 'complete_task' ? 'Completed' : name === 'reopen_task' ? 'Reopened' : name === 'delete_task' ? 'Moved to Trash:' : name === 'reschedule_task' ? 'Rescheduled' : 'Updated';
      return ok(`${verb} “${task.title}”.`, taskView(task, true), task.id);
    };
    try {
      if (!mutations.has(name)) return run(await this.workspace.snapshot());
      const result = await this.workspace.transact(`${this.turn.id}:${call.call_id}`, JSON.stringify({ name, args }), state => {
        const result = run(state);
        if (result.ok) { state.events ??= []; state.events.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: name, taskId: result.taskId, projectId: result.projectId, summary: result.summary }); }
        return result;
      });
      if (result.taskId && !this.turn.knownTaskIds.includes(result.taskId)) this.turn.knownTaskIds.push(result.taskId);
      if (result.projectId && !this.turn.knownProjectIds.includes(result.projectId)) this.turn.knownProjectIds.push(result.projectId);
      return result;
    } catch (error) { return { ok: false, name, summary: error instanceof Error ? error.message : 'The database could not save the action. Nothing was confirmed.' }; }
  }
}
