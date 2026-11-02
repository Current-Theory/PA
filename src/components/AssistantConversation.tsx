import { useEffect, useRef, useState } from 'react';
import { ArrowUp, Mic, Square, MessageSquare, RefreshCw, CircleCheck, AlertCircle, ArrowUpRight, RotateCcw, MessageSquarePlus, X } from 'lucide-react';
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
  const speech = useDictation(text => { if (text) { draftRef.current = `${draftRef.current}${draftRef.current ? ' ' : ''}${text}`.slice(0, 12000); setDraft(draftRef.current); } });
  const submitting = useRef(false);
  const [finalising, setFinalising] = useState(false);
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
    catch (error) { setError(error instanceof Error ? error.message : 'Request failed. Completed actions are saved.'); await changed(); }
    finally { setBusy(false); running.current = false; }
  };
  const send = async (text?: string, selectedTaskId?: string, selectedProjectId?: string) => {
    if (submitting.current || busy || conversation.pending || connection !== 'ready') return;
    submitting.current = true; setFinalising(true); setError('');
    try {
      await speech.finish();
      const message = text ?? draftRef.current;
      if (!message.trim()) return;
      await perform(async () => {
        await engine.send(message, workstream, changed, { selectedTaskId, selectedProjectId });
        draftRef.current = ''; setDraft('');
      });
    } catch (error) { setError(error instanceof Error ? error.message : 'Check your text and try again.'); }
    finally { submitting.current = false; setFinalising(false); }
  };
  const showTask = async (id: string) => { const task = (await workspace.snapshot()).tasks.find(task => task.id === id); if (task && !task.deletedAt) openTask(task); };
  const resultCard = (result: ActionResult, index: number) => <div className={`assistant-action ${result.ok ? '' : 'action-failed'}`} key={index}>
    {result.ok ? <CircleCheck size={14} /> : <AlertCircle size={14} />}<span>{result.summary}</span>
    {result.ok && result.taskId && <button className="text-button" onClick={() => void showTask(result.taskId!)}>View<ArrowUpRight size={12} /></button>}
  </div>;
  const last = conversation.messages.at(-1);
  const clarifications = last?.actions?.filter(action => action.needsClarification && action.candidates?.length) ?? [];
  return <section className="management-assistant" aria-label="Conversation">
    <div className="conversation-toolbar"><span><span className={`status-dot ${connection === 'ready' ? '' : 'offline'}`} />{connection === 'ready' ? 'Connected' : connection === 'checking' ? 'Checking connection…' : 'Not connected'}</span><button className="text-button" disabled={busy || finalising || !!conversation.pending} onClick={() => void perform(() => engine.newConversation(changed))}><MessageSquarePlus size={15} />New conversation</button></div>
    {connection !== 'ready' && connection !== 'checking' && <div className="assistant-setup" role="status"><div><strong>{connection === 'auth' ? 'Sign in required' : connection === 'portable' ? 'Conversations need the hosted app' : 'Connection unavailable'}</strong><div>{connection === 'auth' && <a className="button secondary" href="/.auth/login/aad?post_login_redirect_uri=/assistant-connected.html" target="_blank" rel="noopener noreferrer">Sign in to Work Hub<ArrowUpRight size={13} /></a>}{connection !== 'portable' && <button className="text-button" onClick={() => setAttempt(value => value + 1)}><RefreshCw size={13} />Check connection</button>}</div></div></div>}
    <div ref={logRef} className="conversation-log" role="log" aria-live="polite" aria-label="Conversation history">
      {!conversation.messages.length && <div className="conversation-welcome"><p>No messages.</p></div>}
      {conversation.messages.map(message => <article className={`chat-message chat-${message.role}`} key={message.id}><span className="chat-speaker">{message.role === 'user' ? 'YOU' : 'WORK HUB'}</span><p>{message.text}</p>{message.actions && <div className="assistant-actions">{message.actions.filter(result => !result.ok || result.taskId || result.projectId || result.needsClarification).map(resultCard)}</div>}</article>)}
      {conversation.pending && <div className="pending-request"><span className="chat-speaker">{busy ? 'Working…' : 'Request paused'}</span>{conversation.pending.results.map(resultCard)}{!busy && <p>Completed actions are saved.</p>}</div>}
      {clarifications.length > 0 && !conversation.pending && <div className="clarification-choices" aria-label="Choose the task or project">{clarifications.flatMap(action => action.candidates!.map(candidate => <button className="button secondary" key={candidate.id} disabled={busy || connection !== 'ready'} onClick={() => void send(`I mean “${candidate.title}”. Please continue my previous request for that item.`, action.name === 'search_tasks' ? candidate.id : undefined, action.name === 'search_projects' ? candidate.id : undefined)}>{candidate.title}</button>))}</div>}
      {error && <p className="assistant-error" role="alert"><AlertCircle size={16} />{error}</p>}
    </div>
    {conversation.pending && <div className="conversation-recovery">{busy ? <button className="button secondary" onClick={() => engine.cancel()}><Square size={14} />Stop request</button> : <><button className="button primary" disabled={connection !== 'ready'} onClick={() => void perform(async () => { await engine.resume(workstream, changed); setDraft(''); })}><RotateCcw size={14} />Resume request</button><button className="button secondary" onClick={() => void perform(() => engine.stop(changed))}>Stop request</button></>}</div>}
    <form className="conversation-composer" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="sr-only" htmlFor="assistant-message">Message</label><textarea id="assistant-message" data-autofocus value={draft} maxLength={12000} rows={3} disabled={busy || finalising || !!conversation.pending} placeholder="Write a message…" onChange={event => { draftRef.current = event.target.value; setDraft(event.target.value); }} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (connection === 'ready') void send(); } }} />
      <div className="composer-actions"><button type="button" className={`button secondary ${speech.listening ? 'is-listening' : ''}`} aria-pressed={speech.listening} disabled={!speech.supported || busy || finalising || !!conversation.pending} onClick={speech.listening ? speech.stop : speech.start}>{speech.listening ? <Square size={14} /> : <Mic size={15} />}{speech.listening ? 'Stop dictation' : 'Start dictation'}</button><span>{finalising ? 'Finishing…' : speech.listening ? 'Listening…' : 'Enter to send · Shift+Enter for a new line'}</span><button className="send-message" type="submit" aria-label="Send message" disabled={(!draft.trim() && !speech.listening) || connection !== 'ready' || busy || finalising || !!conversation.pending}><ArrowUp size={19} /></button></div>
    </form>
    {speech.interim && <p className="speech-interim" role="status">{speech.interim}</p>}{speech.error && speech.error !== error && <p className="inline-error" role="alert">{speech.error}</p>}
    <details className="conversation-privacy"><summary>Privacy</summary><p>Messages and relevant task details are sent to OpenAI. Dictation may use your browser’s online speech service.</p></details>
  </section>;
}

export function AssistantPanel({ close, ...props }: Parameters<typeof AssistantConversation>[0] & { close: () => void }) {
  const ref = useRef<HTMLElement>(null); useDialog(ref, close);
  return <div className="drawer-layer"><div className="drawer-backdrop" onClick={close} aria-hidden="true" /><aside className="capture-assistant conversation-panel" role="dialog" aria-modal="true" aria-label="Conversation" ref={ref} tabIndex={-1}><header className="assistant-header"><MessageSquare size={20} /><div><h2>Conversation</h2></div><button className="icon-button" aria-label="Close conversation" onClick={close}><X size={20} /></button></header><AssistantConversation {...props} /></aside></div>;
}
