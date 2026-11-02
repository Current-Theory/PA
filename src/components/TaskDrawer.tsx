import { useRef, useState } from 'react';
import { X, ExternalLink, Plus, Trash2, Check, Pin, Link2, AlignLeft, ListChecks, CornerDownRight } from 'lucide-react';
import { type Task, type Project, type TaskPatch, type TaskField, statusLabels, priorityLabels, safeUrl } from '../lib/model';
import { dateKey, formatDate } from '../lib/dates';
import { useDialog } from '../lib/useDialog';
import { SourceBadge } from './TaskRow';

export function TaskDrawer({ task, projects, workstreams, today, fields, save, remove, close, busy }: {
  task: Task; projects: Project[]; workstreams: string[]; today: string; fields: readonly TaskField[];
  save: (task: Task, patch: TaskPatch) => Promise<boolean>; close: () => void; busy: boolean;
  remove: (task: Task) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<Task>(structuredClone(task));
  const [checkTitle, setCheckTitle] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [error, setError] = useState('');
  const ref = useRef<HTMLElement>(null);
  useDialog(ref, close);
  const can = (field: TaskField) => fields.includes(field);
  const update = <K extends keyof Task>(key: K, value: Task[K]) => setDraft(t => ({ ...t, [key]: value }));
  const persist = async (complete = false) => {
    if (!draft.title.trim()) { setError('Please give the task a title.'); return; }
    const patch: TaskPatch = {};
    for (const key of fields) {
      if (JSON.stringify(draft[key]) !== JSON.stringify(task[key])) Object.assign(patch, { [key]: draft[key] });
    }
    if (complete) patch.status = 'completed';
    if (await save(task, patch)) close();
  };
  const addChecklist = () => {
    if (!checkTitle.trim()) return;
    update('checklist', [...draft.checklist, { id: crypto.randomUUID(), title: checkTitle.trim(), completed: false }]);
    setCheckTitle('');
  };
  const addLink = () => {
    const url = safeUrl(linkUrl);
    if (!url) { setError('Enter a complete http or https web address.'); return; }
    update('resources', [...draft.resources, { id: crypto.randomUUID(), title: linkTitle.trim() || new URL(url).hostname, url }]);
    setLinkTitle(''); setLinkUrl(''); setError('');
  };
  return <div className="drawer-layer">
    <div className="drawer-backdrop" onClick={close} aria-hidden="true" />
    <aside className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-heading" ref={ref} tabIndex={-1}>
      <header className="drawer-top"><span id="drawer-heading">TASK DETAILS</span><button className="icon-button" aria-label="Close task details" onClick={close}><X size={20} /></button></header>
      <div className="drawer-content">
        <div className="drawer-source"><SourceBadge source={task.sourceType} /><span>{task.status === 'completed' ? 'Completed task' : ''}</span></div>
        <label className="sr-only" htmlFor="task-title">Task title</label>
        <textarea id="task-title" data-autofocus className="editable-title" rows={3} maxLength={500} value={draft.title} onChange={e => update('title', e.target.value)} disabled={!can('title')} />
        <button className={`focus-toggle ${draft.focusDate === today ? 'active' : ''}`} disabled={!can('focusDate')} onClick={() => update('focusDate', draft.focusDate === today ? null : today)}><Pin size={15} />{draft.focusDate === today ? 'In Focus Today' : 'Add to Focus Today'}</button>
        <div className="detail-fields">
          <label>Status<select aria-label="Status" value={draft.status} disabled={!can('status')} onChange={e => update('status', e.target.value as Task['status'])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Priority<select aria-label="Priority" value={draft.priority} disabled={!can('priority')} onChange={e => update('priority', e.target.value as Task['priority'])}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Due date<input type="date" value={draft.dueDate ?? ''} disabled={!can('dueDate')} onChange={e => update('dueDate', e.target.value || null)} /></label>
          <label>Workstream<select aria-label="Workstream" value={draft.workstream} disabled={!can('workstream')} onChange={e => update('workstream', e.target.value)}>{workstreams.map(w => <option key={w}>{w}</option>)}</select></label>
          <label>Project<select aria-label="Project" value={draft.projectId ?? ''} disabled={!can('projectId')} onChange={event => update('projectId', event.target.value || null)}><option value="">No project</option>{projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
        </div>
        {draft.status === 'waiting' && <div className="waiting-box"><label>Waiting on<input placeholder="Person or team" maxLength={200} value={draft.waitingFor} disabled={!can('waitingFor')} onChange={e => update('waitingFor', e.target.value)} /></label><label>Follow-up date<input type="date" value={draft.followUpDate ?? ''} disabled={!can('followUpDate')} onChange={e => update('followUpDate', e.target.value || null)} /></label></div>}
        <section className="detail-section"><h3><AlignLeft size={16} />Notes</h3><label className="sr-only" htmlFor="task-notes">Task notes</label><textarea id="task-notes" rows={5} value={draft.notes} maxLength={30000} disabled={!can('notes')} placeholder="Task notes…" onChange={e => update('notes', e.target.value)} /></section>
        <section className="detail-section"><h3><ListChecks size={16} />Checklist <span>{draft.checklist.filter(i => i.completed).length}/{draft.checklist.length}</span></h3>
          {draft.checklist.map(item => <div className="checklist-row" key={item.id}><input type="checkbox" aria-label={item.title} checked={item.completed} disabled={!can('checklist')} onChange={() => update('checklist', draft.checklist.map(i => i.id === item.id ? { ...i, completed: !i.completed } : i))} /><span className={item.completed ? 'checked-text' : ''}>{item.title}</span><button className="icon-button" aria-label={`Remove checklist item ${item.title}`} disabled={!can('checklist')} onClick={() => update('checklist', draft.checklist.filter(i => i.id !== item.id))}><X size={14} /></button></div>)}
          {can('checklist') && <div className="inline-add"><input aria-label="New checklist item" placeholder="Add a step…" maxLength={500} value={checkTitle} onChange={e => setCheckTitle(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addChecklist(); } }} /><button className="icon-button" aria-label="Add checklist item" onClick={addChecklist}><Plus size={17} /></button></div>}
        </section>
        <section className="detail-section"><h3><CornerDownRight size={16} />Outcome / completion note</h3><textarea aria-label="Completion note" rows={3} maxLength={10000} value={draft.completionNote} disabled={!can('completionNote')} placeholder="Completion note…" onChange={e => update('completionNote', e.target.value)} />{task.completedAt && <p className="field-hint">Completed {formatDate(dateKey(new Date(task.completedAt)), today)}</p>}</section>
        <section className="detail-section"><h3><Link2 size={16} />Related resources</h3>
          {draft.resources.map(resource => <div className="resource-row" key={resource.id}>{safeUrl(resource.url) ? <a href={safeUrl(resource.url)} target="_blank" rel="noopener noreferrer">{resource.title}<ExternalLink size={12} /></a> : <span>{resource.title} (invalid link)</span>}<button className="icon-button" aria-label={`Remove resource ${resource.title}`} disabled={!can('resources')} onClick={() => update('resources', draft.resources.filter(r => r.id !== resource.id))}><Trash2 size={13} /></button></div>)}
          {can('resources') && <div className="resource-inputs"><input aria-label="Resource title" placeholder="Link title" maxLength={200} value={linkTitle} onChange={e => setLinkTitle(e.target.value)} /><div className="inline-add"><input aria-label="Resource URL" type="url" placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} /><button className="icon-button" aria-label="Add resource" onClick={addLink}><Plus size={17} /></button></div></div>}
        </section>
        <section className="source-context"><span className="eyebrow">ORIGINAL CONTEXT</span><p>{task.sourceName}</p>{task.sourceUrl && safeUrl(task.sourceUrl) && <a href={safeUrl(task.sourceUrl)} target="_blank" rel="noopener noreferrer">Open original <ExternalLink size={13} /></a>}<span className="field-hint">{task.provider === 'local' ? 'Saved on this device' : task.provider === 'mock' ? 'Sample task' : `Microsoft ${task.provider}`}</span></section>
        {error && <p role="alert" className="inline-error">{error}</p>}
      </div>
      <footer className="drawer-footer"><button className="icon-button" aria-label="Move task to Trash" disabled={busy || task.provider !== 'local'} onClick={async () => { if (await remove(task)) close(); }}><Trash2 size={16} /></button><button className="button secondary" disabled={busy} onClick={() => void persist()}>{busy ? 'Saving…' : 'Save changes'}</button>{draft.status !== 'completed' && <button className="button primary" disabled={busy || !can('status')} onClick={() => void persist(true)}><Check size={16} />Complete task</button>}</footer>
    </aside>
  </div>;
}
