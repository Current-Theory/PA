import { useState } from 'react';
import { ArrowUpRight, Plus, Pencil, Trash2, Check, X, Layers, Sparkles } from 'lucide-react';
import type { Task } from '../lib/model';

export function Workstreams({ names, tasks, open, capture, add, rename, remove, busy }: {
  names: string[]; tasks: Task[]; open: (name: string) => void; busy: boolean;
  capture: (name: string) => void;
  add: (name: string) => Promise<boolean>; rename: (from: string, to: string) => Promise<boolean>; remove: (name: string) => Promise<boolean>;
}) {
  const [name, setName] = useState('');
  const [editing, setEditing] = useState('');
  const [editName, setEditName] = useState('');
  return <>
    <div className="workstream-intro"><Layers size={21} /><p>A place for every part of your work. Group tasks by responsibility, rather than where they arrived.</p></div>
    <form className="workstream-add" onSubmit={async e => { e.preventDefault(); if (await add(name)) setName(''); }}><input aria-label="New workstream name" placeholder="Name a new workstream…" maxLength={80} value={name} onChange={e => setName(e.target.value)} required /><button className="button primary" disabled={busy}><Plus size={16} />Add workstream</button></form>
    <div className="workstream-grid">{names.map((w, index) => {
      const active = tasks.filter(t => t.workstream === w && t.status !== 'completed').length;
      const waiting = tasks.filter(t => t.workstream === w && t.status === 'waiting').length;
      return <article key={w} className="workstream-card"><div className="ws-card-top"><span className={`workstream-symbol ws-bg-${index % 5}`}><Layers size={20} /></span><div><button className="icon-button" aria-label={`Rename ${w}`} onClick={() => { setEditing(w); setEditName(w); }}><Pencil size={14} /></button><button className="icon-button" disabled={busy} aria-label={`Remove workstream ${w}`} onClick={() => void remove(w)}><Trash2 size={14} /></button></div></div>
        {editing === w ? <form className="inline-add" onSubmit={async e => { e.preventDefault(); if (await rename(w, editName)) setEditing(''); }}><input aria-label={`New name for ${w}`} value={editName} onChange={e => setEditName(e.target.value)} maxLength={80} required autoFocus /><button className="icon-button" aria-label="Save workstream name" disabled={busy}><Check size={17} /></button><button type="button" className="icon-button" aria-label="Cancel rename" onClick={() => setEditing('')}><X size={17} /></button></form> : <h2>{w}</h2>}
        <p><strong>{active}</strong> active task{active !== 1 ? 's' : ''}{waiting > 0 && <span> · {waiting} waiting</span>}</p><div className="workstream-card-actions"><button className="text-button" onClick={() => open(w)}>View tasks<ArrowUpRight size={15} /></button><button className="text-button" aria-label={`Capture with ChatGPT in ${w}`} onClick={() => capture(w)}><Sparkles size={14} />Capture</button></div>
      </article>;
    })}</div>
  </>;
}
