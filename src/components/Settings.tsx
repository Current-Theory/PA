import { useRef, useState } from 'react';
import { X, ShieldCheck, Monitor, Check, ArrowUpRight, RotateCcw } from 'lucide-react';
import { useDialog } from '../lib/useDialog';
import { microsoftConfiguration } from '../lib/microsoft';

export function Settings({ close, reset, offline }: { close: () => void; reset: () => Promise<boolean>; offline: boolean }) {
  const ref = useRef<HTMLElement>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  useDialog(ref, close);
  return <div className="modal-layer"><div className="drawer-backdrop" onClick={close} aria-hidden="true" /><section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-heading" ref={ref} tabIndex={-1}>
    <header><div><span className="eyebrow">YOUR WORKSPACE</span><h2 id="settings-heading">Settings & connections</h2></div><button className="icon-button" aria-label="Close settings" onClick={close}><X size={21} /></button></header>
    <div className="settings-body">
      <div className="connection-card"><div className="connection-icon"><Monitor size={23} /></div><div><h3>Demo workspace</h3><p>Fictional sample tasks. Changes are saved in this browser’s IndexedDB, on this device only. Don’t enter confidential work information.</p><span className="connection-tag"><Check size={12} />{offline ? 'Available offline on this device' : 'Device-local · no cloud sync'}</span></div></div>
      <div className="connection-card"><div className="connection-icon microsoft-mark"><i /><i /><i /><i /></div><div><h3>Microsoft 365 <span className="small-badge">Not connected</span></h3><p>To Do for personal work. Planner for shared work. One view, with Microsoft 365 as the source of truth.</p><p className="field-hint">{microsoftConfiguration() ? 'Entra configuration detected. Live providers still need implementation and tenant validation.' : 'Requires your organisation’s Entra SPA registration and completed provider integration.'}</p><span className="connection-tag muted">Integration scaffold · no Microsoft requests made</span></div></div>
      <div className="settings-note"><ShieldCheck size={20} /><p>No separate Work Hub password. The live integration will use Microsoft sign-in with delegated task permissions. No analytics or AI services are included.</p></div>
      <h3>Make it your daily workspace</h3><p>{import.meta.env.VITE_PORTABLE === 'true' ? 'This download runs directly from its HTML file. Keep the file in a permanent folder and open it in the same browser to return to your demo. Installing as a PWA requires the hosted HTTPS version.' : 'Install Work Hub from your browser’s app menu or pin it to your taskbar. The application shell works offline; live Microsoft tasks will require connectivity.'}</p>
      <h3>Keyboard shortcuts</h3><div className="shortcuts"><span>Find a task <kbd>Ctrl / ⌘ K</kbd></span><span>Quick capture <kbd>N</kbd></span><span>Close a panel <kbd>Esc</kbd></span></div>
      <a className="settings-doc-link" href="https://learn.microsoft.com/graph/api/resources/todo-overview?view=graph-rest-1.0" target="_blank" rel="noopener noreferrer">About Microsoft To Do integration<ArrowUpRight size={15} /></a>
      <div className="reset-area"><h3>Demo data</h3><p>Restore the fictional sample workspace. This removes all tasks and workstream changes you’ve made in this demo.</p>{confirmReset ? <div className="reset-confirm" role="alert"><strong>Replace all local demo data?</strong><div><button className="button danger" disabled={resetting} onClick={async () => { setResetting(true); try { if (await reset()) setConfirmReset(false); } finally { setResetting(false); } }}>{resetting ? 'Resetting…' : 'Yes, restore demo'}</button><button className="button secondary" disabled={resetting} onClick={() => setConfirmReset(false)}>Cancel</button></div></div> : <button className="button secondary" onClick={() => setConfirmReset(true)}><RotateCcw size={14} />Reset demo workspace</button>}</div>
    </div>
  </section></div>;
}
