import { useEffect, useRef, useState } from 'react';

interface SpeechResult { isFinal: boolean; 0: { transcript: string } }
interface Recognition {
  lang: string; continuous: boolean; interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<SpeechResult> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null; onstart: (() => void) | null;
  start(): void; stop(): void; abort(): void;
}
type SpeechWindow = Window & { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
type Timer = ReturnType<typeof setTimeout>;
interface Run { recognition: Recognition; pending: string; delivered: Set<number> }
interface Session {
  mode: 'listening' | 'stopping';
  run?: Run;
  restart?: Timer;
  drain?: { promise: Promise<void>; resolve: () => void; reject: (error: Error) => void; timer: Timer };
}

function detach(recognition: Recognition) {
  recognition.onresult = null; recognition.onerror = null; recognition.onend = null; recognition.onstart = null;
}
function discard(session: Session) {
  clearTimeout(session.restart); clearTimeout(session.drain?.timer);
  if (session.run) {
    detach(session.run.recognition);
    try { session.run.recognition.abort(); } catch { /* Already stopped. */ }
    session.run = undefined;
  }
}

export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  // A logical session can span many independent browser recognition runs.
  const active = useRef<Session | null>(null);
  const callback = useRef(onText); callback.current = onText;
  const speechWindow = window as SpeechWindow;
  const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
  const supported = !!Constructor;

  useEffect(() => () => {
    const session = active.current; active.current = null;
    if (session) { discard(session); session.drain?.reject(new Error('Dictation closed.')); }
  }, []);

  const preservePending = (session: Session) => {
    if (session.run?.pending.trim()) callback.current(session.run.pending.trim());
    if (session.run) session.run.pending = '';
    setInterim('');
  };
  const close = (session: Session, message?: string) => {
    if (active.current !== session) return;
    preservePending(session); active.current = null; discard(session);
    setListening(false); setStopping(false);
    if (message) { setError(message); session.drain?.reject(new Error(message)); }
    else session.drain?.resolve();
  };
  const startRun = (session: Session) => {
    if (active.current !== session || session.mode !== 'listening' || !Constructor) return;
    let recognition: Recognition;
    try { recognition = new Constructor(); }
    catch { close(session, 'Dictation could not start. Type or use Windows dictation (Win+H).'); return; }
    // Fresh objects/index sets prevent replayed callbacks from a previous run
    // being confused with new speech at the same result index.
    const run: Run = { recognition, pending: '', delivered: new Set() };
    session.run = run;
    const current = () => active.current === session && session.run === run;
    const restart = (delay = 0) => {
      preservePending(session); detach(recognition); session.run = undefined;
      if (session.mode === 'listening') {
        // Leave the browser's end callback before starting a fresh run.
        session.restart = setTimeout(() => { session.restart = undefined; startRun(session); }, delay);
      } else close(session);
    };
    recognition.lang = 'en-NZ'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => { /* Listening belongs to the logical session. */ };
    recognition.onresult = event => {
      if (!current()) return;
      const final: string[] = []; const pending: string[] = [];
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal && !run.delivered.has(index)) { final.push(result[0].transcript.trim()); run.delivered.add(index); }
        else if (!result.isFinal) pending.push(result[0].transcript.trim());
      }
      run.pending = pending.filter(Boolean).join(' ');
      if (final.length) callback.current(final.filter(Boolean).join(' '));
      setInterim(run.pending);
    };
    recognition.onerror = event => {
      if (!current()) return;
      if (event.error === 'no-speech' && session.mode === 'listening') {
        // Silence is not a logical Stop. Some browsers report it as an error.
        restart(150);
        try { recognition.abort(); } catch { /* Already ended. */ }
        return;
      }
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was denied. Type or use Windows dictation (Win+H).',
        'audio-capture': 'No microphone found. Check your input device.',
        'network': 'Dictation is unavailable. Type or use Windows dictation (Win+H).',
        'no-speech': 'No speech detected. Check your text before sending.'
      };
      close(session, messages[event.error] ?? 'Dictation stopped. Check your text before sending.');
    };
    recognition.onend = () => { if (current()) restart(); };
    try { recognition.start(); }
    catch { if (current()) close(session, 'Dictation could not start. Type or use Windows dictation (Win+H).'); }
  };

  // Stop and Send share finalisation, but only the composer's explicit Send
  // submits anything. Natural end/restart events never resolve a Send operation.
  const finish = (): Promise<void> => {
    const session = active.current;
    if (!session) return Promise.resolve();
    if (session.drain) return session.drain.promise;
    session.mode = 'stopping'; clearTimeout(session.restart); session.restart = undefined;
    if (!session.run) { close(session); return Promise.resolve(); }
    setStopping(true);
    let resolve!: () => void; let reject!: (error: Error) => void;
    const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    const timer = setTimeout(() => close(session, 'Dictation did not finish. Check your text, then send again.'), 5000);
    session.drain = { promise, resolve, reject, timer };
    try { session.run.recognition.stop(); }
    catch { close(session, 'Could not finish dictation. Check your text and try again.'); }
    return promise;
  };
  const stop = () => { void finish().catch(() => { /* The transcript and error remain in the composer. */ }); };
  const start = () => {
    if (active.current || !Constructor) return;
    const session: Session = { mode: 'listening' };
    active.current = session; setError(''); setInterim(''); setListening(true); startRun(session);
  };
  return { supported, listening, stopping, interim, error, start, stop, finish };
}
