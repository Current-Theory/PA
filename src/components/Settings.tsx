import { useRef, useState } from 'react';
import { X, RotateCcw, Download } from 'lucide-react';
import { useDialog } from '../lib/useDialog';

export function Settings({ close, reset, backup, offline }: { close: () => void; reset: () => Promise<boolean>; backup: () => Promise<void>; offline: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  useDialog(ref, close);
  return <div className="modal-layer"><div className="drawer-backdrop" onClick={close} aria-hidden="true" /><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading" ref={ref} tabIndex={-1}>
    <header><h2 id="settings-heading">Settings & connections</h2><button className="icon-button" aria-label="Close settings" onClick={close}><X size={21} /></button></header>
    <div className="settings-body">
      <section className="settings-section"><h3>Storage</h3><p>Tasks, Daily Notes and conversations are saved on this device. There is no cloud sync. Clearing browser data removes them.</p><p>{offline ? 'Offline' : 'Online'}</p></section>
      <section className="settings-section"><h3>Microsoft 365</h3><p>Task sync is not connected. Microsoft sign-in provides access to Work Hub; it does not connect your To Do or Planner tasks.</p></section>
      <section className="settings-section"><h3>Privacy</h3><p>Conversations send messages and relevant task details to OpenAI. Credentials stay on the server. Use approved storage for confidential work.</p>
      {import.meta.env.PROD && import.meta.env.VITE_PORTABLE !== 'true' && <p><a href="/.auth/logout?post_logout_redirect_uri=/access-denied">Sign out of Work Hub</a></p>}</section>
      <section className="settings-section"><h3>Install</h3><p>{import.meta.env.VITE_PORTABLE === 'true' ? 'This download runs directly from its HTML file. Keep it in the same location and browser to retain your workspace.' : 'Install from your browser’s app menu or pin to the taskbar. Opening the hosted app requires an Internet connection.'}</p></section>
      <section className="settings-section"><h3>Keyboard shortcuts</h3><div className="shortcuts"><span>Search <kbd>Ctrl+K</kbd></span><span>Focus input <kbd>N</kbd></span><span>Close panel <kbd>Esc</kbd></span></div></section>
      <section className="settings-section"><h3>Backup</h3><p>Download tasks, Daily Notes, projects and history. Conversations and credentials are excluded.</p><button className="button secondary" onClick={() => void backup()}><Download size={14} />Download workspace backup</button></section>
      <div className="reset-area"><h3>Reset workspace</h3><p>Replace tasks, notes, projects and conversations with sample data. Download a backup first.</p>{confirmReset ? <div className="reset-confirm" role="alert"><strong>Replace all local data?</strong><div><button className="button danger" disabled={resetting} onClick={async () => { setResetting(true); try { if (await reset()) setConfirmReset(false); } finally { setResetting(false); } }}>{resetting ? 'Resetting…' : 'Yes, restore sample data'}</button><button className="button secondary" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancel</button></div></div> : <button className="button secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={14} />Reset workspace</button>}</div>
    </div>
  </section></div>;
}
