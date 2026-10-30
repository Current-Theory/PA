import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square, Sparkles, RefreshCw, CircleCheck, AlertCircle, ArrowUpRight, RotateCcw, MessageSquarePlus, X } from 'lucide-react';
import { useDictation } from '../lib/useDictation';
import { useDialog } from '../lib/useDialog';
import { AssistantEngine } from '../assistant/engine';
import type { Conversation, ActionResult } from '../assistant/contracts';
import type { Task } from '../lib/model';
import { WorkspaceProvider } from '../providers/WorkspaceProvider';

export function AssistantConversation({ conversation, engine, workspace, workstream, changed, openTask }: {
  conversation: Conversation; engine: AssistantEngine; workspace: WorkspaceProvider;
  workstream: string; changed: () => Promise<void>; openTask: (task: Task) => void;
}) {
  const [draft, setDraft] = useState('');
  const [localBusy, setBusy] = useState(false);
  const busy = localBusy || engine.isRunning;
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<'checking' | 'ready' | 'auth' | 'unavailable' | 'portable'>('checking');
  const [attempt, setAttempt] = useState(0);
  const running = useRef(false);
  const draftRef = useRef(draft); draftRef.current = draft;
  const logRef = useRef<HTMLDivElement>(null);
  const speech = useDictation(text => { if (text) setDraft(`${draftRef.current}${draftRef.current ? ' ' : ''}${text}`.slice(0, 12000)); });
  useEffect(() => {
    if (import.meta.env.VITE_PORTABLE === 'true' || !/^https?:$/.test(location.protocol)) { setConnection('portable'); return; }
    const controller = new AbortController(); setConnection('checking');
    void fetch('/api/assistant/status', { signal: controller.signal, cache: 'no-store' }).then(async response => {
      if (response.status === 401 || response.status === 403) { setConnection('auth'); return; }
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) { setConnection('unavailable'); return; }
      const status = await response.json(); setConnection(status.ready === true ? 'ready' : 'unavailable');
    }).catch(() => { if (!controller.signal.aborted) setConnection('unavailable'); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [conversation.messages.length, conversation.pending?.results.length]);
  const perform = async (operation: () => Promise<void>) => {
    if (running.current) return;
    running.current = true; setBusy(true); setError(''); speech.stop();
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : 'The assistant could not finish. Your confirmed actions remain saved.'); await changed(); }
    finally { setBusy(false); running.current = false; }
  };
  const send = async (text = draft, selectedTaskId?: string, selectedProjectId?: string) => {
    if (!text.trim() || busy || conversation.pending) return;
    await perform(async () => {
      await engine.send(text, workstream, changed, { selectedTaskId, selectedProjectId }); setDraft('');
    });
  };
  const showTask = async (id: string) => { const task = (await workspace.snapshot()).tasks.find(task => task.id === id); if (task && !task.deletedAt) openTask(task); };
  const resultCard = (result: ActionResult, index: number) => <div className={`assistant-action ${result.ok ? '' : 'action-failed'}`} key={index}>
    {result.ok ? <CircleCheck size={14} /> : <AlertCircle size={14} />}<span>{result.summary}</span>
    {result.ok && result.taskId && <button className="text-button" onClick={() => void showTask(result.taskId!)}>View<ArrowUpRight size={12} /></button>}
  </div>;
  const last = conversation.messages.at(-1);
  const clarifications = last?.actions?.filter(action => action.needsClarification && action.candidates?.length) ?? [];
  return <section className="management-assistant" aria-label="Management assistant">
    <div className="conversation-toolbar"><span><span className={`status-dot ${connection === 'ready' ? '' : 'offline'}`} />{connection === 'ready' ? 'Secure AI connection configured' : connection === 'checking' ? 'Checking connection…' : 'Assistant connection required'}</span><button className="text-button" disabled={busy || !!conversation.pending} onClick={() => void perform(() => engine.newConversation(changed))}><MessageSquarePlus size={15} />New conversation</button></div>
    {connection !== 'ready' && connection !== 'checking' && <div className="assistant-setup" role="status"><Sparkles size={19} /><div><strong>{connection === 'auth' ? 'Sign in to use your assistant' : connection === 'portable' ? 'Your assistant needs the hosted app' : 'The secure assistant isn’t connected yet'}</strong><p>{connection === 'auth' ? 'Sign in in a separate tab, then check the connection here. Your work stays open.' : connection === 'portable' ? 'This local file can manage your saved tasks. In-app AI needs a hosted server connection; an API key must never be put into this file.' : 'Ask your administrator to enable the secure AI connection. Your tasks, projects and history remain available without it.'}</p><div>{connection === 'auth' && <a className="button primary" href="/.auth/login/aad?post_login_redirect_uri=/assistant-connected.html" target="_blank" rel="noopener noreferrer">Sign in to Work Hub<ArrowUpRight size={13} /></a>}{connection !== 'portable' && <button className="text-button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={13} />Check connection</button>}</div></div></div>}
    <div ref={logRef} className="conversation-log" role="log" aria-live="polite" aria-label="Assistant conversation">
      {!conversation.messages.length && <div className="conversation-welcome"><span className="assistant-symbol"><Sparkles size={23} /></span><h2>Less administration.<br />A clearer next step.</h2><p>Tell me what’s happening. I can keep track of tasks, remember the context, and help you decide what matters next.</p><div className="conversation-starters">{['What do I actually need to get done today?', 'I’ve got too much on. What should I focus on?', 'I need to review those Moodle questions next week, but it’s not urgent.'].map(text => <button key={text} disabled={connection !== 'ready' || busy} onClick={() => void send(text)}>{text}<ArrowUpRight size={14} /></button>)}</div></div>}
      {conversation.messages.map(message => <article className={`chat-message chat-${message.role}`} key={message.id}><span className="chat-speaker">{message.role === 'user' ? 'YOU' : 'WORK HUB'}</span><p>{message.text}</p>{message.actions && <div className="assistant-actions">{message.actions.filter(result => !result.ok || result.taskId || result.projectId || result.needsClarification).map(resultCard)}</div>}</article>)}
      {conversation.pending && <div className="pending-request"><span className="chat-speaker">{busy ? 'WORKING WITH YOUR WORKSPACE…' : 'REQUEST PAUSED'}</span>{conversation.pending.results.map(resultCard)}{!busy && <p>Any confirmed actions above are already saved. Resume safely or stop this request.</p>}</div>}
      {clarifications.length > 0 && !conversation.pending && <div className="clarification-choices" aria-label="Choose the task or project">{clarifications.flatMap(action => action.candidates!.map(candidate => <button className="button secondary" key={candidate.id} disabled={busy || connection !== 'ready'} onClick={() => void send(`I mean “${candidate.title}”. Please continue my previous request for that item.`, action.name === 'search_tasks' ? candidate.id : undefined, action.name === 'search_projects' ? candidate.id : undefined)}>{candidate.title}</button>))}</div>}
      {error && <p className="assistant-error" role="alert"><AlertCircle size={16} />{error}</p>}
    </div>
    {conversation.pending && <div className="conversation-recovery">{busy ? <button className="button secondary" onClick={() => engine.cancel()}><Square size={14} />Stop request</button> : <><button className="button primary" disabled={connection !== 'ready'} onClick={() => void perform(async () => { await engine.resume(workstream, changed); setDraft(''); })}><RotateCcw size={14} />Resume request</button><button className="button secondary" onClick={() => void perform(() => engine.stop(changed))}>Stop and keep saved actions</button></>}</div>}
    <form className="conversation-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor="assistant-message">Message your assistant</label><textarea id="assistant-message" data-autofocus value={draft} maxLength={12000} rows={3} disabled={busy || !!conversation.pending} placeholder="Tell me what needs to happen…" onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (connection === 'ready') void send(); } }} />
      <div className="composer-actions"><button type="button" className={`button secondary ${speech.listening ? 'is-listening' : ''}`} aria-pressed={speech.listening} disabled={!speech.supported || busy || !!conversation.pending} onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? <Square size={14} /> : <Mic size={15} />}{speech.listening ? 'Stop dictation' : 'Start dictation'}</button><span>{speech.listening ? 'Listening…' : 'Enter to send · Shift+Enter for a new line'}</span><button className="send-message" type="submit" aria-label="Send message" disabled={!draft.trim() || connection !== 'ready' || busy || !!conversation.pending || speech.listening}><ArrowUp size={19} /></button></div>
    </form>
    {speech.interim && <p className="speech-interim" role="status">{speech.interim}</p>}{speech.error && <p className="inline-error" role="alert">{speech.error}</p>}
    <p className="assistant-privacy">Sending lets the assistant read relevant task/project context and run validated actions. Voice starts only when you choose; your browser may use an online speech service.</p>
  </section>;
}

export function AssistantPanel({ close, ...props }: Parameters<typeof AssistantConversation>[0] & { close: () => void }) {
  const ref = useRef<HTMLElement>(null); useDialog(ref, close);
  return <div className="drawer-layer"><div className="drawer-backdrop" onClick={close} aria-hidden="true" /><aside className="capture-assistant conversation-panel" role="dialog" aria-modal="true" aria-label="Your management assistant" ref={ref} tabIndex={-1}><header className="assistant-header"><span className="assistant-symbol"><Sparkles size={20} /></span><div><span className="eyebrow">YOUR WORK, IN CONTEXT</span><h2>Talk it through</h2></div><button className="icon-button" aria-label="Close assistant" onClick={close}><X size={20} /></button></header><AssistantConversation {...props} /></aside></div>;
}
