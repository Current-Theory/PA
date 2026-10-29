import { useEffect, useRef, useState } from 'react';
import { Sparkles, X, Mic, Square, Copy, ExternalLink, ArrowRight, Plus, Trash2, Check, FileJson, AlertCircle } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { useDictation } from '../lib/useDictation';
import { buildChatGptPrompt, parseTaskSuggestions, type CaptureRequest, type CaptureProposal } from '../lib/capture';
import { priorityLabels, statusLabels, type TaskDraft } from '../lib/model';

export function CaptureAssistant({ note, setNote, initialWorkstream, workstreams, today, close, capture }: {
  note: string; setNote: (note: string) => void; initialWorkstream: string; workstreams: string[]; today: string;
  close: () => void; capture: (drafts: TaskDraft[]) => Promise<boolean>;
}) {
  const ref = useRef<HTMLElement>(null);
  useDialog(ref, close);
  const [workstream, setWorkstream] = useState(initialWorkstream);
  const [mode, setMode] = useState<'describe' | 'import'>('describe');
  const [reply, setReply] = useState('');
  const [proposal, setProposal] = useState<CaptureProposal | null>(null);
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [connectionAttempt, setConnectionAttempt] = useState(0);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const noteRef = useRef(note);
  const proposalHeading = useRef<HTMLHeadingElement>(null);
  noteRef.current = note;
  const speech = useDictation(text => { if (text) { setNote(`${noteRef.current}${noteRef.current ? ' ' : ''}${text}`.slice(0, 12000)); setProposal(null); } });
  const abort = useRef<AbortController | null>(null);
  const lock = useRef(false);
  const request: CaptureRequest = { note, workstream, workstreams, today };
  const prompt = buildChatGptPrompt(request);
  useEffect(() => {
    if (import.meta.env.VITE_PORTABLE === 'true' || !/^https?:$/.test(location.protocol)) return;
    const controller = new AbortController(); setChecking(true);
    void fetch('/api/assistant/status', { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        setAuthNeeded(response.status === 401 || response.status === 403);
        if (response.ok && response.headers.get('content-type')?.includes('application/json')) {
          const status = await response.json();
          setAvailable(status.ready === true);
        }
      }).catch(() => { /* The copy/import path works without a server. */ }).finally(() => setChecking(false));
    return () => { controller.abort(); };
  }, [connectionAttempt]);
  useEffect(() => () => abort.current?.abort(), []);
  const readReply = (value: unknown) => {
    setProposal(null);
    const parsed = parseTaskSuggestions(value, workstreams, workstream);
    setProposal(parsed); setError('');
    setTimeout(() => { proposalHeading.current?.scrollIntoView({ block: 'start' }); proposalHeading.current?.focus({ preventScroll: true }); }, 0);
  };
  const suggest = async () => {
    if (lock.current) return;
    lock.current = true; setWorking(true); setError(''); speech.stop();
    const controller = new AbortController(); abort.current = controller;
    const timer = setTimeout(() => controller.abort(), 65000);
    try {
      const response = await fetch('/api/assistant/capture', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request), signal: controller.signal
      });
      if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('The assistant server did not respond. Your note is still here; use copy/import or retry later.');
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'The assistant could not respond. Your note is still here.');
      readReply(data);
    } catch (error) { setError(error instanceof Error && error.name !== 'AbortError' ? error.message : 'The request stopped or timed out. Your note is still here; retry or use copy/import.'); }
    finally { clearTimeout(timer); setWorking(false); lock.current = false; }
  };
  const copyPrompt = async () => {
    setError('');
    try { await navigator.clipboard.writeText(prompt); setCopied(true); }
    catch { setShowPrompt(true); setError('Clipboard access is unavailable. Select and copy the prepared prompt below.'); }
  };
  const edit = <K extends keyof TaskDraft>(index: number, key: K, value: TaskDraft[K]) => setProposal(current => current ? { ...current, tasks: current.tasks.map((task, i) => i === index ? { ...task, [key]: value } : task) } : current);
  const commit = async () => {
    if (!proposal || lock.current) return;
    lock.current = true; setWorking(true); setError(''); speech.stop();
    try {
      const parsed = parseTaskSuggestions({ tasks: proposal.tasks.map(task => ({ ...task, checklist: task.checklist.map(step => step.trim()).filter(Boolean) })) }, workstreams, workstream);
      // Keep the original spoken/typed context, even if the assistant summarized it.
      const drafts = parsed.tasks.map(task => ({ ...task, notes: [task.notes, note.trim() ? `Original capture:\n${note.trim()}` : ''].filter(Boolean).join('\n\n') }));
      if (await capture(drafts)) { setNote(''); close(); }
    } catch (error) { setError(error instanceof Error ? error.message : 'Check the task details and try again.'); }
    finally { setWorking(false); lock.current = false; }
  };
  return <div className="drawer-layer assistant-layer">
    <div className="drawer-backdrop" onClick={() => { if (!working) close(); }} aria-hidden="true" />
    <aside className="capture-assistant" role="dialog" aria-modal="true" aria-labelledby="assistant-heading" ref={ref} tabIndex={-1}>
      <header className="assistant-header"><span className="assistant-symbol"><Sparkles size={20} /></span><div><span className="eyebrow">CAPTURE THE NEXT STEP</span><h2 id="assistant-heading">Think out loud. Find your next step.</h2></div><button className="icon-button" aria-label="Close capture assistant" onClick={close} disabled={working}><X size={20} /></button></header>
      <div className="assistant-scroll">
        <p className="assistant-intro">Start with the context. Turn it into clear actions without losing your place.</p>
        <label className="assistant-workstream">You’re working in<select aria-label="Capture workstream" value={workstream} disabled={working} onChange={e => setWorkstream(e.target.value)}>{workstreams.map(w => <option key={w}>{w}</option>)}</select></label>
        <div className="assistant-tabs" role="group" aria-label="Capture method"><button aria-pressed={mode === 'describe'} onClick={() => setMode('describe')}>Describe the work</button><button aria-pressed={mode === 'import'} onClick={() => setMode('import')}><FileJson size={14} />Import ChatGPT reply</button></div>
        {mode === 'describe' ? <>
          <label className="assistant-label" htmlFor="capture-note">What needs to happen?</label>
          <textarea id="capture-note" data-autofocus rows={6} value={note} maxLength={12000} disabled={working} onChange={e => { setNote(e.target.value); setCopied(false); setProposal(null); }} placeholder="For example: I need to design the new EarnLearn package. Victoria has asked me to do the quality assurance…" />
          <div className="dictation-row"><button className={`button secondary ${speech.listening ? 'is-listening' : ''}`} aria-pressed={speech.listening} disabled={!speech.supported || working} onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? <Square size={14} /> : <Mic size={15} />}{speech.listening ? 'Stop dictation' : 'Start dictation'}</button><span>{speech.supported ? 'Microphone starts only when you choose.' : 'Type here, or use Windows dictation: Win+H.'}</span></div>
          {speech.interim && <p className="speech-interim" role="status">{speech.interim}</p>}
          {speech.error && <p className="inline-error" role="alert">{speech.error}</p>}
          <p className="assistant-privacy">Browser dictation may use your browser’s online speech service. Typing stays here until you choose to send or copy it.</p>
          <div className="assistant-connection"><span className={`status-dot ${available ? '' : 'offline'}`} /><div><strong>{checking ? 'Checking assistant connection…' : authNeeded ? 'Sign in to the hosted assistant' : available ? 'In-app assistant configured' : 'Use your ChatGPT account'}</strong><p>{authNeeded ? 'Sign in in a separate tab, then check the connection here. Your note and workstream stay open.' : available ? 'Suggest tasks sends this note and your workstream names to the configured OpenAI API. Review its suggestions before saving.' : 'The download cannot embed your signed-in ChatGPT session. Copy the prepared prompt, use ChatGPT (including its voice mode), then bring its JSON reply back here.'}</p></div></div>
          {authNeeded && <div className="chatgpt-actions"><a className="button primary" href="/.auth/login/aad?post_login_redirect_uri=/assistant-connected.html" target="_blank" rel="noopener noreferrer">Sign in to Work Hub<ExternalLink size={13} /></a><button className="button secondary" disabled={checking} onClick={() => setConnectionAttempt(value => value + 1)}>Check connection</button></div>}
          {available && <button className="button primary suggest-button" disabled={!note.trim() || working || speech.listening} onClick={() => void suggest()}><Sparkles size={16} />{working ? 'Finding the next steps…' : 'Suggest tasks'}</button>}
          <div className="chatgpt-actions"><button className="button secondary" disabled={!note.trim() || working} onClick={() => void copyPrompt()}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? 'Prompt copied' : 'Copy prompt for ChatGPT'}</button><a className="button secondary" href="https://chatgpt.com/" target="_blank" rel="noopener noreferrer">Open ChatGPT<ExternalLink size={13} /></a><button className="text-button" onClick={() => setMode('import')}>Bring the reply back<ArrowRight size={14} /></button></div>
          <button className="text-button" onClick={() => setShowPrompt(!showPrompt)}>{showPrompt ? 'Hide prepared prompt' : 'View prepared prompt'}</button>
          {showPrompt && <textarea className="prepared-prompt" aria-label="Prepared ChatGPT prompt" readOnly rows={7} value={prompt} onFocus={e => e.target.select()} />}
        </> : <div className="import-reply">{proposal ? <div className="reply-ready"><span><Check size={15} />Reply imported. Review the suggestions below.</span><button className="text-button" onClick={() => { setProposal(null); setError(''); }}>Replace reply</button></div> : <><label className="assistant-label" htmlFor="chatgpt-reply">Paste ChatGPT’s JSON reply</label><p>Use the prepared prompt from “Describe the work” so the reply includes titles, notes, workstreams and next steps. Nothing is added until you review it.</p><textarea id="chatgpt-reply" rows={7} value={reply} maxLength={100000} onChange={e => setReply(e.target.value)} placeholder={'{ "summary": "…", "tasks": [ … ] }'} /><div className="import-reply-actions"><button className="button primary" disabled={!reply.trim() || working} onClick={() => { try { readReply(reply); } catch (error) { setError(error instanceof Error ? error.message : 'Could not import this response.'); } }}>Review suggestions<ArrowRight size={14} /></button><label className="button secondary"><FileJson size={14} />Import JSON file<input className="sr-only" aria-label="Import ChatGPT JSON file" type="file" accept=".json,application/json" onChange={async e => { const file = e.target.files?.[0]; if (!file) return; try { if (file.size > 100000) throw new Error('Choose a JSON file smaller than 100 KB.'); const value = await file.text(); setReply(value); readReply(value); } catch (error) { setError(error instanceof Error ? error.message : 'Could not read the JSON file.'); } e.target.value = ''; }} /></label></div></>}</div>}
        {error && <p className="assistant-error" role="alert"><AlertCircle size={16} />{error}</p>}
        {proposal && <section className="proposal-review" aria-labelledby="proposal-heading"><div className="proposal-heading"><span className="assistant-symbol small"><Check size={16} /></span><div><h3 id="proposal-heading" ref={proposalHeading} tabIndex={-1}>Review your next steps</h3><p>{proposal.summary || 'Check the details before adding these to your workspace.'}</p></div></div>
          {proposal.warnings.map((warning, index) => <p className="proposal-warning" key={index}>{warning}</p>)}
          {proposal.tasks.map((task, index) => <article className="proposal-card" key={index}><div className="proposal-card-top"><span>STEP {index + 1}</span><button className="icon-button" aria-label={`Remove suggestion ${index + 1}`} disabled={working} onClick={() => setProposal(p => p ? { ...p, tasks: p.tasks.filter((_, i) => i !== index) } : p)}><Trash2 size={14} /></button></div><label>Task title<input aria-label={`Suggestion ${index + 1} title`} value={task.title} maxLength={500} onChange={e => edit(index, 'title', e.target.value)} disabled={working} /></label><div className="proposal-fields"><label>Workstream<select aria-label={`Suggestion ${index + 1} workstream`} value={task.workstream} onChange={e => edit(index, 'workstream', e.target.value)} disabled={working}>{workstreams.map(w => <option key={w}>{w}</option>)}</select></label><label>Due date<input aria-label={`Suggestion ${index + 1} due date`} type="date" value={task.dueDate ?? ''} onChange={e => edit(index, 'dueDate', e.target.value || null)} disabled={working} /></label><label>Priority<select aria-label={`Suggestion ${index + 1} priority`} value={task.priority} onChange={e => edit(index, 'priority', e.target.value as TaskDraft['priority'])} disabled={working}>{Object.entries(priorityLabels).map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label><label>Status<select aria-label={`Suggestion ${index + 1} status`} value={task.status} onChange={e => edit(index, 'status', e.target.value as TaskDraft['status'])} disabled={working}>{Object.entries(statusLabels).filter(([key]) => key !== 'completed').map(([key, title]) => <option value={key} key={key}>{title}</option>)}</select></label></div><label>Context / notes<textarea aria-label={`Suggestion ${index + 1} notes`} rows={3} value={task.notes} maxLength={12000} onChange={e => edit(index, 'notes', e.target.value)} disabled={working} /></label>{task.status === 'waiting' && <div className="proposal-fields"><label>Waiting on<input aria-label={`Suggestion ${index + 1} waiting on`} value={task.waitingFor} maxLength={200} onChange={e => edit(index, 'waitingFor', e.target.value)} /></label><label>Follow-up date<input aria-label={`Suggestion ${index + 1} follow-up date`} type="date" value={task.followUpDate ?? ''} onChange={e => edit(index, 'followUpDate', e.target.value || null)} /></label></div>}<label>Next steps <span className="field-hint">One checklist step per line</span><textarea aria-label={`Suggestion ${index + 1} checklist`} rows={Math.min(5, Math.max(2, task.checklist.length))} value={task.checklist.join('\n')} onChange={e => edit(index, 'checklist', e.target.value.split('\n'))} disabled={working} /></label><label className="proposal-focus"><input type="checkbox" checked={task.focusToday} onChange={e => edit(index, 'focusToday', e.target.checked)} disabled={working} /><span><strong>Show in Focus Today</strong><small>So this action is there when you open Today.</small></span></label></article>)}
          {!proposal.tasks.length && <p className="field-hint">All suggestions removed. Import a new reply to start again.</p>}
        </section>}
      </div>
      <footer className="assistant-footer"><span>{proposal ? `${proposal.tasks.length} task${proposal.tasks.length === 1 ? '' : 's'} · nothing saved yet` : 'Your workstream stays open behind this panel.'}</span><button className="button primary" disabled={!proposal?.tasks.length || working || speech.listening} onClick={() => void commit()}><Plus size={16} />{working ? 'Working…' : `Add ${proposal?.tasks.length ?? ''} task${proposal?.tasks.length === 1 ? '' : 's'}`}</button></footer>
    </aside>
  </div>;
}
