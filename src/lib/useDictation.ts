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

export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState('');
  const active = useRef<Recognition | null>(null);
  const ending = useRef<{ resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null>(null);
  const preservePending = useRef(() => {});
  const callback = useRef(onText);
  callback.current = onText;
  const speechWindow = window as SpeechWindow;
  const supported = !!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  useEffect(() => () => {
    if (ending.current) { clearTimeout(ending.current.timer); ending.current.reject(new Error('Dictation closed.')); ending.current = null; }
    if (active.current) { active.current.onresult = null; active.current.onerror = null; active.current.onend = null; active.current.onstart = null; active.current.abort(); active.current = null; }
  }, []);
  const stop = () => active.current?.stop();
  const finish = (): Promise<void> => {
    if (!active.current) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        // Do not submit a partial transcript if the browser fails to finish.
        ending.current = null;
        preservePending.current();
        if (active.current) { active.current.onresult = null; active.current.onerror = null; active.current.onend = null; active.current.onstart = null; active.current.abort(); }
        active.current = null; setListening(false);
        const message = 'Dictation did not finish. Check your text, then send again.';
        setError(message); reject(new Error(message));
      }, 5000);
      ending.current = { resolve, reject, timer };
      try { active.current!.stop(); }
      catch { clearTimeout(timer); ending.current = null; preservePending.current(); reject(new Error('Could not finish dictation. Check your text and try again.')); }
    });
  };
  const start = () => {
    if (active.current) return;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    const recognition = new Constructor();
    const delivered = new Set<number>();
    let pending = '';
    const keepPending = () => { if (pending.trim()) callback.current(pending.trim()); pending = ''; setInterim(''); };
    preservePending.current = keepPending;
    active.current = recognition; setError(''); setInterim(''); setListening(true);
    recognition.lang = 'en-NZ'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = event => {
      if (active.current !== recognition) return;
      const final: string[] = [];
      pending = '';
      for (let index = 0; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal && !delivered.has(index)) { final.push(result[0].transcript.trim()); delivered.add(index); }
        else if (!result.isFinal) pending += `${pending ? ' ' : ''}${result[0].transcript}`;
      }
      if (final.length) callback.current(final.join(' '));
      setInterim(pending);
    };
    recognition.onerror = event => {
      if (active.current !== recognition) return;
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was denied. Type or use Windows dictation (Win+H).',
        'audio-capture': 'No microphone found. Check your input device.',
        'network': 'Dictation is unavailable. Type or use Windows dictation (Win+H).',
        'no-speech': 'No speech detected. Try again.'
      };
      const message = messages[event.error] ?? 'Dictation stopped. Check your text before sending.';
      keepPending(); setError(message); setListening(false); active.current = null;
      if (ending.current) { clearTimeout(ending.current.timer); ending.current.reject(new Error(message)); ending.current = null; }
    };
    recognition.onend = () => {
      if (active.current !== recognition) return;
      keepPending(); setListening(false); active.current = null;
      if (ending.current) { clearTimeout(ending.current.timer); ending.current.resolve(); ending.current = null; }
    };
    try { recognition.start(); } catch { active.current = null; setListening(false); setError('Dictation could not start. Type or use Windows dictation (Win+H).'); }
  };
  return { supported, listening, interim, error, start, stop, finish };
}
