import { describe, it, expect } from 'vitest';
import { todayTasks } from '../src/lib/today';
import { seedTasks } from '../src/providers/seed';
import type { Task } from '../src/lib/model';

const today = '2026-11-02';
const base = seedTasks(today)[0];
const task = (id: string, patch: Partial<Task>): Task => ({ ...base, id, focusDate: null, dueDate: null, status: 'notStarted', ...patch });
describe('Today is a unique actionable view of existing tasks', () => {
  it('keeps future-due focus tasks and partitions overlapping work by priority of section', () => {
    const input = [
      task('future-focus', { dueDate: '2026-12-01', focusDate: today }),
      task('overdue-focus', { dueDate: '2026-10-30', focusDate: today }),
      task('overdue', { dueDate: '2026-10-31' }), task('due', { dueDate: today }),
      task('waiting', { status: 'waiting', dueDate: today, followUpDate: today }),
      task('waiting-focus', { status: 'waiting', focusDate: today, followUpDate: today }),
      task('future', { dueDate: '2026-11-05' }),
      task('done', { status: 'completed', focusDate: today }), task('deleted', { deletedAt: '2026-11-01', dueDate: today })
    ];
    const result = todayTasks(input, today);
    expect(result.focus.map(task => task.id)).toEqual(['future-focus', 'overdue-focus', 'waiting-focus']);
    expect(result.overdue.map(task => task.id)).toEqual(['overdue']);
    expect(result.due.map(task => task.id)).toEqual(['due']);
    expect(result.followUp.map(task => task.id)).toEqual(['waiting']);
    const ids = [...result.focus, ...result.overdue, ...result.due, ...result.followUp].map(task => task.id);
    expect(new Set(ids).size).toBe(result.count); expect(result.count).toBe(6);
    expect(input[0].dueDate).toBe('2026-12-01');
  });
  it('surfaces overdue, today and undated follow-ups, without pulling future follow-ups into Today', () => {
    const result = todayTasks([
      task('late', { status: 'waiting', followUpDate: '2026-11-01' }),
      task('today', { status: 'waiting', followUpDate: today }),
      task('undated', { status: 'waiting', followUpDate: null }),
      task('later', { status: 'waiting', followUpDate: '2026-11-03', dueDate: '2026-10-01' })
    ], today);
    expect(result.followUp.map(task => task.id)).toEqual(['late', 'today', 'undated']);
    expect(result.overdue).toEqual([]);
  });
});
