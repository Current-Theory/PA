import { Search, X } from 'lucide-react';
import { sourceTypes, priorityLabels } from '../lib/model';
import { emptyFilters, type FiltersState } from '../lib/filters';
export function Filters({ value, change, workstreams, history, searchPage }: {
  value: FiltersState; change: (next: FiltersState) => void; workstreams: string[]; history: boolean; searchPage: boolean;
}) {
  const set = (key: keyof FiltersState, next: string) => change({ ...value, [key]: next });
  const active = Object.values(value).some(Boolean);
  return <div className="filters">
    <div className="search-field"><Search size={17} /><input id="task-search" aria-label={searchPage ? 'Search tasks and notes' : 'Search tasks'} placeholder={searchPage ? 'Search tasks and notes…' : history ? 'Search your work history…' : 'Search titles, notes, people…'} value={value.text} onChange={e => set('text', e.target.value)} /></div>
    <div className="filter-controls">
      <select aria-label="Filter workstream" value={value.workstream} onChange={e => set('workstream', e.target.value)}><option value="">All workstreams</option>{workstreams.map(w => <option key={w}>{w}</option>)}</select>
      <select aria-label="Filter source" value={value.source} onChange={e => set('source', e.target.value)}><option value="">All sources</option>{sourceTypes.map(s => <option key={s}>{s}</option>)}</select>
      {!history && <><select aria-label="Filter priority" value={value.priority} onChange={e => set('priority', e.target.value)}><option value="">Any priority</option>{Object.entries(priorityLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select><select aria-label="Filter status" value={value.status} onChange={e => set('status', e.target.value)}><option value="">{searchPage ? 'All statuses' : 'Active tasks'}</option><option value="waiting">Waiting</option><option value="inProgress">In progress</option><option value="notStarted">Not started</option><option value="completed">Completed</option><option value="all">Active & completed</option></select><select aria-label="Filter due date" value={value.due} onChange={e => set('due', e.target.value)}><option value="">Any due date</option><option value="today">Due today</option><option value="overdue">Overdue</option><option value="week">Next 7 days</option><option value="none">No due date</option></select></>}
      {history && <><label className="date-filter">From<input aria-label="Completed from" type="date" value={value.completedFrom} onChange={e => set('completedFrom', e.target.value)} /></label><label className="date-filter">To<input aria-label="Completed to" type="date" value={value.completedTo} onChange={e => set('completedTo', e.target.value)} /></label></>}
      {active && <button className="text-button clear-filters" onClick={() => change({ ...emptyFilters })}><X size={13} />Clear filters</button>}
    </div>
  </div>;
}
