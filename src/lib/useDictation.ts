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
  const callback = useRef(onText);
  callback.current = onText;
  const speechWindow = window as SpeechWindow;
  const supported = !!(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition);
  useEffect(() => () => {
    if (active.current) { active.current.onresult = null; active.current.onerror = null; active.current.onend = null; active.current.onstart = null; active.current.abort(); }
  }, []);
  const stop = () => active.current?.stop();
  const start = () => {
    if (active.current) return;
    const Constructor = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Constructor) return;
    const recognition = new Constructor();
    active.current = recognition; setError(''); setInterim('');
    recognition.lang = 'en-NZ'; recognition.continuous = true; recognition.interimResults = true;
    recognition.onstart = () => setListening(true);
    recognition.onresult = event => {
      let pending = '';
      const final: string[] = [];
      for (let index = event.resultIndex; index < event.results.length; index++) {
        const result = event.results[index];
        if (result.isFinal) final.push(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      if (final.length) callback.current(final.join(' '));
      setInterim(pending);
    };
    recognition.onerror = event => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access was not allowed. You can type, or use Windows dictation (Win+H).',
        'audio-capture': 'No microphone was found. Check your input device or type your note.',
        'network': 'Your browser’s speech service is unavailable. Try typing or Windows dictation (Win+H).',
        'no-speech': 'No speech was detected. Try again or type your note.'
      };
      setError(messages[event.error] ?? 'Dictation stopped. Your captured text is still here.');
      setListening(false); setInterim(''); active.current = null;
    };
    recognition.onend = () => { setListening(false); setInterim(''); active.current = null; };
    try { recognition.start(); } catch { active.current = null; setError('Dictation could not start. Try typing or Windows dictation (Win+H).'); }
  };
  return { supported, listening, interim, error, start, stop };
}
