import { Check, ChevronRight, Flag, Mail, Users, Columns3, ListTodo, PenLine, Clock3, Pin } from 'lucide-react';
import type { SourceType, Task } from '../lib/model';
import { dateKey, formatDate } from '../lib/dates';

const sourceIcons = { Outlook: Mail, Teams: Users, Planner: Columns3, 'To Do': ListTodo, Manual: PenLine };
export function SourceBadge({ source }: { source: SourceType }) {
  const Icon = sourceIcons[source];
  return <span className={`source source-${source.toLowerCase().replace(' ', '-')}`}><Icon size={13} aria-hidden="true" />{source}</span>;
}
export function TaskRow({ task, today, onOpen, onComplete, onFocus, busy, finishing, history = false }: {
  task: Task; today: string; onOpen: (task: Task) => void; onComplete: (task: Task) => void;
  onFocus: (task: Task) => void; busy: boolean; finishing: boolean; history?: boolean;
}) {
  const completed = task.status === 'completed';
  const overdue = !completed && task.dueDate && task.dueDate < today;
  return <article className={`task-row ${finishing ? 'finishing' : ''} ${completed ? 'is-completed' : ''}`}>
    <button className="task-check" role="checkbox" aria-checked={completed || finishing} aria-label={`${completed ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => onComplete(task)} disabled={busy}>
      {(completed || finishing) && <Check size={15} strokeWidth={3} />}
    </button>
    <button className="task-main" onClick={() => onOpen(task)} aria-label={`Open ${task.title}`}>
      <span className="task-title">{task.title}</span>
      <span className="task-meta"><span className={`workstream-dot ws-${Math.abs(task.workstream.length % 5)}`} />{task.workstream}
        {task.status === 'waiting' && <span className="waiting-meta"><Clock3 size={12} />{task.waitingFor || 'Awaiting a response'}{task.followUpDate && task.followUpDate <= today ? ' · Follow up today' : ''}</span>}
        {task.status === 'inProgress' && <span className="progress-meta">In progress</span>}
      </span>
      {history && task.completionNote && <span className="history-note">{task.completionNote}</span>}
    </button>
    <div className="task-right">
      {(task.priority === 'high' || task.priority === 'critical') && <span className={`priority priority-${task.priority}`}><Flag size={12} />{task.priority === 'critical' ? 'Critical' : 'High'}</span>}
      <SourceBadge source={task.sourceType} />
      {(task.dueDate || completed) && <span className={`task-date ${overdue ? 'overdue-date' : ''}`}>{completed ? `Done ${formatDate(task.completedAt ? dateKey(new Date(task.completedAt)) : null, today)}` : `${overdue ? 'Overdue · ' : ''}${formatDate(task.dueDate, today)}`}</span>}
      {!completed && <button className={`icon-button focus-button ${task.focusDate === today ? 'selected' : ''}`} aria-label={`${task.focusDate === today ? 'Remove from' : 'Add to'} focus: ${task.title}`} aria-pressed={task.focusDate === today} onClick={() => onFocus(task)} disabled={busy}><Pin size={16} /></button>}
      <button className="icon-button row-open" aria-label={`Details for ${task.title}`} onClick={() => onOpen(task)}><ChevronRight size={16} /></button>
    </div>
  </article>;
}
