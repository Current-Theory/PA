import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays } from '../lib/dates';
import type { WorkspaceProvider } from '../providers/WorkspaceProvider';

export function DailyNote({ date, today, notes, workspace, change, saved, selectDate, visible }: {
  date: string; today: string; notes: Record<string, string>; workspace: WorkspaceProvider;
  change: (date: string, text: string) => void; saved: (date: string, text: string) => void; selectDate: (date: string) => void; visible: boolean;
}) {
  const [status, setStatus] = useState<'saved' | 'saving' | 'error'>('saved');
  const [error, setError] = useState('');
  const revision = useRef(0);
  const save = async (text: string) => {
    const version = ++revision.current;
    change(date, text); setStatus('saving'); setError('');
    try { await workspace.saveDailyNote(date, text); saved(date, text); if (version === revision.current) setStatus('saved'); }
    catch (error) { if (version === revision.current) { setStatus('error'); setError(error instanceof Error ? error.message : 'Could not save this note.'); } }
  };
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (status !== 'saved') event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [status]);
  const dates = Object.keys(notes).filter(key => notes[key]).sort().reverse();
  return <section className="daily-notebook" hidden={!visible} aria-label="Daily Note">
    <div className="notebook-heading"><h2>Daily Note</h2><div className="note-dates">
      <button className="icon-button" aria-label="Previous day’s note" disabled={status !== 'saved'} onClick={() => selectDate(addDays(date, -1))}><ChevronLeft size={16} /></button>
      <input aria-label="Note date" type="date" value={date} disabled={status !== 'saved'} onChange={event => { if (event.target.value) selectDate(event.target.value); }} />
      <button className="icon-button" aria-label="Next day’s note" disabled={status !== 'saved'} onClick={() => selectDate(addDays(date, 1))}><ChevronRight size={16} /></button>
      {date !== today && <button className="text-button" disabled={status !== 'saved'} onClick={() => selectDate(today)}>Today</button>}
    </div></div>
    <label className="sr-only" htmlFor="daily-note">Daily Note text</label>
    <textarea id="daily-note" value={notes[date] ?? ''} maxLength={60000} rows={5} placeholder="Notes for the day…" onChange={event => void save(event.target.value)} />
    <div className="notebook-footer"><span role="status">{status === 'saving' ? 'Saving…' : status === 'error' ? 'Not saved' : 'Saved on this device'}</span>
      {dates.length > 0 && <label>History<select aria-label="Note history" disabled={status !== 'saved'} value={dates.includes(date) ? date : ''} onChange={event => { if (event.target.value) selectDate(event.target.value); }}><option value="" disabled>Select date</option>{dates.map(key => <option key={key} value={key}>{key}</option>)}</select></label>}
    </div>
    {status === 'error' && <p role="alert" className="inline-error">{error} <button className="text-button" onClick={() => void save(notes[date] ?? '')}>Retry save</button></p>}
  </section>;
}
