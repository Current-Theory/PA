import type { Task } from './model';

// Focus is an intention for today, independent of the task's due date.
// Precedence keeps every task in exactly one section of the Today surface.
export function todayTasks(tasks: Task[], today: string) {
  const active = tasks.filter(task => !task.deletedAt && task.status !== 'completed');
  const focus = active.filter(task => task.focusDate === today);
  const remaining = active.filter(task => task.focusDate !== today);
  const overdue = remaining.filter(task => task.status !== 'waiting' && task.dueDate && task.dueDate < today)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!));
  const due = remaining.filter(task => task.status !== 'waiting' && task.dueDate === today);
  const followUp = remaining.filter(task => task.status === 'waiting' && (!task.followUpDate || task.followUpDate <= today))
    .sort((a, b) => (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999'));
  return { focus, overdue, due, followUp, count: focus.length + overdue.length + due.length + followUp.length };
}
