import { useState } from 'react';
import { FolderOpen, ArrowUpRight, MessageSquare, Plus } from 'lucide-react';
import type { Project, Task } from '../lib/model';
import { formatDate } from '../lib/dates';

type ProjectInput = Pick<Project, 'name' | 'workstream' | 'notes' | 'dueDate'>;
export function Projects({ projects, tasks, workstreams, busy, create, openTasks, discuss }: {
  projects: Project[]; tasks: Task[]; workstreams: string[]; busy: boolean;
  create: (input: ProjectInput) => Promise<boolean>; openTasks: (id: string) => void; discuss: (project: Project) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [stream, setStream] = useState('');
  const [date, setDate] = useState('');
  const [notes, setNotes] = useState('');
  return <>
    {adding ? <form className="project-create" aria-label="Create project" onSubmit={async event => {
      event.preventDefault();
      if (await create({ name, workstream: stream || workstreams[0], dueDate: date || null, notes })) {
        setName(''); setDate(''); setNotes(''); setAdding(false);
      }
    }}>
      <label>Project name<input autoFocus required maxLength={150} value={name} onChange={event => setName(event.target.value)} disabled={busy} /></label>
      <label>Workstream<select aria-label="Workstream" required value={stream || workstreams[0]} onChange={event => setStream(event.target.value)} disabled={busy}>{workstreams.map(workstream => <option key={workstream}>{workstream}</option>)}</select></label>
      <label>Target date<input type="date" value={date} onChange={event => setDate(event.target.value)} disabled={busy} /></label>
      <label className="project-create-notes">Notes<textarea rows={2} maxLength={30000} value={notes} onChange={event => setNotes(event.target.value)} disabled={busy} /></label>
      <div className="project-create-actions"><button className="button primary" disabled={busy || !name.trim()}>Create project</button><button className="button secondary" type="button" onClick={() => setAdding(false)} disabled={busy}>Cancel</button></div>
    </form> : <div className="project-toolbar"><button className="button secondary" onClick={() => setAdding(true)}><Plus size={16} />New project</button></div>}
    {projects.length ? <div className="workstream-grid">{projects.map(project => {
      const related = tasks.filter(task => task.projectId === project.id);
      const outstanding = related.filter(task => task.status !== 'completed');
      return <article className="workstream-card project-card" key={project.id}>
        <div className="ws-card-top"><span className="project-status">{project.status === 'onHold' ? 'On hold' : project.status === 'completed' ? 'Completed' : 'Active'}</span></div>
        <h2>{project.name}</h2><p className="project-meta">{project.workstream}{project.dueDate ? ` · Target ${formatDate(project.dueDate)}` : ''}</p>
        {project.notes && <p className="project-context">{project.notes}</p>}
        <p><strong>{outstanding.length}</strong> outstanding task{outstanding.length === 1 ? '' : 's'} · {related.length - outstanding.length} completed</p>
        <div className="workstream-card-actions"><button className="text-button" onClick={() => openTasks(project.id)}>View tasks<ArrowUpRight size={14} /></button><button className="text-button" onClick={() => discuss(project)}><MessageSquare size={14} />Conversation</button></div>
      </article>;
    })}</div> : <div className="empty-state"><FolderOpen size={24} /><h2>No projects</h2></div>}
  </>;
}
