import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Sun, ListTodo, CalendarDays, Clock3, CircleCheck, Layers, Search, Settings as SettingsIcon, ChevronRight, Plus, ArrowUpRight, Menu, X, Star, ArrowRight, Check, WifiOff, Download, RefreshCw, CircleHelp, Inbox, Sparkles, TriangleAlert } from 'lucide-react';
import { registerPwa } from './lib/pwa';
import { MockTaskProvider } from './providers/MockTaskProvider';
import { TaskHub } from './providers/TaskHub';
import { type Task, type TaskPatch, searchableText } from './lib/model';
import { addDays, dateKey, formatDate, upcomingGroup } from './lib/dates';
import { TaskRow } from './components/TaskRow';
import { TaskDrawer } from './components/TaskDrawer';
import { Filters } from './components/Filters';
import { emptyFilters, type FiltersState } from './lib/filters';
import { Settings } from './components/Settings';
import { Workstreams } from './components/Workstreams';
import { useDialog } from './lib/useDialog';
import { CaptureAssistant } from './components/CaptureAssistant';

const demo = new MockTaskProvider();
const hub = new TaskHub([demo]);
const pages = {
  today: { label: 'Today', icon: Sun, subtitle: 'A little clarity. A productive day.' },
  all: { label: 'All Tasks', icon: ListTodo, subtitle: 'Everything on your plate, in one place.' },
  upcoming: { label: 'Upcoming', icon: CalendarDays, subtitle: 'See what’s ahead. Give yourself room to prepare.' },
  waiting: { label: 'Waiting', icon: Clock3, subtitle: 'Keep the conversation moving.' },
  completed: { label: 'Completed', icon: CircleCheck, subtitle: 'Work done. Context kept.' },
  workstreams: { label: 'Workstreams', icon: Layers, subtitle: 'Bring structure to the different parts of your work.' },
  search: { label: 'Search', icon: Search, subtitle: 'Find the task. Recover the context.' }
};
type Page = keyof typeof pages;
interface InstallPrompt extends Event { prompt(): Promise<void>; userChoice: Promise<{ outcome: string }> }
function readPage(): Page { const key = window.location.hash.slice(1); return key in pages ? key as Page : 'today'; }

export function App() {
  const [page, setPage] = useState<Page>(readPage);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workstreams, setWorkstreams] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [today, setToday] = useState(dateKey());
  const [offline, setOffline] = useState(!navigator.onLine);
  const [selected, setSelected] = useState<Task | null>(null);
  const [settings, setSettings] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [filters, setFilters] = useState<FiltersState>({ ...emptyFilters });
  const [capture, setCapture] = useState('');
  const [captureWorkstream, setCaptureWorkstream] = useState('');
  const [assistantWorkstream, setAssistantWorkstream] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantNote, setAssistantNote] = useState('');
  const [finishing, setFinishing] = useState<string[]>([]);
  const [toast, setToast] = useState<{ message: string; error?: boolean; task?: Task; undo?: () => Promise<void> } | null>(null);
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const updater = useRef<(() => Promise<void>) | null>(null);
  const captureRef = useRef<HTMLInputElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const mutationLock = useRef(false);
  const closeDrawer = useCallback(() => setSelected(null), []);
  const closeSettings = useCallback(() => setSettings(false), []);
  const closeMobileNav = useCallback(() => setMobileNav(false), []);
  const closeAssistant = useCallback(() => setAssistantOpen(false), []);
  const refresh = useCallback(async () => {
    const [nextTasks, nextWorkstreams] = await Promise.all([hub.list(), demo.workstreams()]);
    setTasks(nextTasks); setWorkstreams(nextWorkstreams);
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { await refresh(); } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load the workspace.'); }
    finally { setLoading(false); }
  }, [refresh]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const listener = () => { setPage(readPage()); setFilters({ ...emptyFilters }); setMobileNav(false); setSelected(null); };
    window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener);
  }, []);
  useEffect(() => {
    const check = () => { setOffline(!navigator.onLine); setToday(dateKey()); };
    window.addEventListener('online', check); window.addEventListener('offline', check);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 60_000);
    const install = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallPrompt); };
    window.addEventListener('beforeinstallprompt', install);
    return () => { window.removeEventListener('online', check); window.removeEventListener('offline', check); window.removeEventListener('focus', check); window.removeEventListener('beforeinstallprompt', install); clearInterval(timer); };
  }, []);
  useEffect(() => {
    updater.current = registerPwa(() => setUpdateAvailable(true));
  }, []);
  useEffect(() => {
    if (!toast || toast.error) return;
    const timer = setTimeout(() => setToast(null), 9000); return () => clearTimeout(timer);
  }, [toast]);
  const navigate = useCallback((next: Page) => {
    setPage(next); setFilters({ ...emptyFilters }); setMobileNav(false); setSelected(null);
    window.history.replaceState(null, '', `#${next}`);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (selected || settings || assistantOpen) return;
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); navigate('search'); setTimeout(() => document.getElementById('task-search')?.focus(), 50); }
      else if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'n') { event.preventDefault(); captureRef.current?.focus(); }
      else if (event.key === 'Escape') setMobileNav(false);
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [navigate, selected, settings, assistantOpen]);
  const act = async (operation: () => Promise<void>): Promise<boolean> => {
    if (mutationLock.current) return false;
    mutationLock.current = true; setBusy(true);
    try { await operation(); return true; }
    catch (error) { setToast({ error: true, message: error instanceof Error ? error.message : 'Something went wrong. Please retry.' }); return false; }
    finally { mutationLock.current = false; setBusy(false); }
  };
  const save = (task: Task, patch: TaskPatch): Promise<boolean> => act(async () => {
    await hub.update(task, patch); await refresh(); setToast({ message: patch.status === 'completed' ? 'Task completed. Context kept in your work history.' : 'Task changes saved.' });
  });
  const complete = (task: Task) => {
    if (task.status === 'completed') { void save(task, { status: 'notStarted' }); return; }
    void act(async () => {
      const updated = await hub.update(task, { status: 'completed' });
      setFinishing(ids => [...ids, task.id]);
      await new Promise(resolve => setTimeout(resolve, 320));
      setFinishing(ids => ids.filter(id => id !== task.id));
      await refresh();
      setToast({ message: 'Task completed. A useful step forward.', task: updated, undo: async () => {
        await hub.update(updated, { status: task.status, completedAt: task.completedAt }); await refresh();
      } });
    });
  };
  const focus = (task: Task) => void save(task, { focusDate: task.focusDate === today ? null : today });
  const currentCaptureWorkstream = filters.workstream || (workstreams.includes(captureWorkstream) ? captureWorkstream : workstreams[0]);
  const openAssistant = (workstream = currentCaptureWorkstream) => {
    setAssistantWorkstream(workstream); setCaptureWorkstream(workstream);
    if (!assistantNote && capture) setAssistantNote(capture);
    setAssistantOpen(true);
  };
  const quickCapture = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!capture.trim()) return;
    await act(async () => {
      const task = await hub.create(capture, currentCaptureWorkstream);
      setCapture(''); await refresh();
      setToast({ message: 'Task captured and added to Focus Today.', task });
    });
  };
  const active = tasks.filter(t => t.status !== 'completed');
  const focused = active.filter(t => t.focusDate === today);
  const waitingToday = active.filter(t => t.status === 'waiting' && t.focusDate !== today)
    .sort((a, b) => (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999'))
    .filter((t, index) => (t.followUpDate && t.followUpDate <= today) || index < 3);
  const completedToday = tasks.filter(t => t.status === 'completed' && t.completedAt && dateKey(new Date(t.completedAt)) === today).length;
  const counts: Partial<Record<Page, number>> = { today: focused.length, all: active.length, waiting: active.filter(t => t.status === 'waiting').length, completed: tasks.length - active.length };
  const matches = (task: Task) => {
    if (filters.text && !searchableText(task).includes(filters.text.toLocaleLowerCase())) return false;
    if (filters.workstream && task.workstream !== filters.workstream) return false;
    if (filters.source && task.sourceType !== filters.source) return false;
    if (filters.priority && task.priority !== filters.priority) return false;
    if (filters.status && filters.status !== 'all' && task.status !== filters.status) return false;
    if (!filters.status && page === 'all' && task.status === 'completed') return false;
    if (filters.due === 'today' && task.dueDate !== today) return false;
    if (filters.due === 'overdue' && (!task.dueDate || task.dueDate >= today)) return false;
    if (filters.due === 'week' && (!task.dueDate || task.dueDate < today || task.dueDate > addDays(today, 7))) return false;
    if (filters.due === 'none' && task.dueDate) return false;
    if (filters.completedFrom && (!task.completedAt || dateKey(new Date(task.completedAt)) < filters.completedFrom)) return false;
    if (filters.completedTo && (!task.completedAt || dateKey(new Date(task.completedAt)) > filters.completedTo)) return false;
    return true;
  };
  const byDue = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  const row = (task: Task, history = false) => <TaskRow key={task.id} task={task} today={today} onOpen={setSelected} onComplete={complete} onFocus={focus} busy={busy} finishing={finishing.includes(task.id)} history={history} />;
  const section = (title: string, items: Task[], icon: ReactNode, className = '', empty?: string, action?: ReactNode) => items.length || empty ? <section className={`task-section ${className}`} key={title}><div className="section-header"><h2>{icon}{title}<span className="section-count">{items.length}</span></h2>{action}</div>{items.length ? <div className="task-list">{items.map(t => row(t))}</div> : <div className="section-empty">{empty}</div>}</section> : null;
  const navLink = (key: Page) => {
    const Icon = pages[key].icon;
    return <a href={`#${key}`} className={`nav-item ${page === key ? 'active' : ''}`} key={key} aria-current={page === key ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(key); }}><Icon size={19} strokeWidth={1.7} /><span>{pages[key].label}</span>{counts[key] !== undefined && <span className="nav-count">{counts[key]}</span>}{key === 'search' && <kbd>⌘ K</kbd>}</a>;
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to workspace</a>
    {mobileNav && <div className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-hidden="true" />}
    {mobileNav && <MobileNavFocus navRef={navRef} close={closeMobileNav} />}
    <aside id="navigation" ref={navRef} tabIndex={-1} role={mobileNav ? 'dialog' : undefined} aria-modal={mobileNav ? true : undefined} className={`sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Workspace navigation">
      <a className="brand" href="#today" onClick={e => { e.preventDefault(); navigate('today'); }} aria-label="EarnLearn Work Hub home"><span className="brand-word"><span>Earn</span><span>Learn</span><b aria-hidden="true">+</b></span><span className="brand-caption">WORK HUB</span></a>
      <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={22} /></button>
      <div className="workspace-label"><span className="workspace-monogram">EL</span><div>My workspace<small>Programme management</small></div></div>
      <span className="nav-eyebrow">YOUR WORK</span><nav aria-label="Main">{(['today', 'all', 'upcoming', 'waiting', 'completed', 'workstreams'] as Page[]).map(navLink)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-message"><span className="geometry-plus">+</span><p>Less noise.<br /><strong>More progress.</strong></p></div><nav aria-label="Tools">{navLink('search')}<button className="nav-item" onClick={() => { setSettings(true); setMobileNav(false); }}><SettingsIcon size={19} strokeWidth={1.7} /><span>Settings</span></button></nav><button className="sync-status" onClick={() => setSettings(true)}><span className={`status-dot ${offline ? 'offline' : ''}`} /><span>{offline ? 'Offline · demo available' : 'Demo workspace'}<small>{offline ? 'Microsoft sync unavailable' : 'Saved on this device'}</small></span><ChevronRight size={14} /></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNav} aria-controls="navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={21} /></button><span>My workspace</span><ChevronRight size={13} /><strong>{pages[page].label}</strong></div><div className="topbar-right"><button className="demo-pill" onClick={() => setSettings(true)}><span />Demo mode<CircleHelp size={13} /></button><span className="topbar-divider" /><span className="profile-name">Ian Barnes<small>Programme Manager</small></span><span className="avatar" aria-label="Ian Barnes">IB</span></div></header>
      {offline && <div className="connection-banner" role="status"><WifiOff size={16} />You’re offline. Your local demo is available. Live Microsoft data cannot sync.</div>}
      {updateAvailable && <div className="connection-banner"><RefreshCw size={16} />An update is ready. Save any open task before reloading.<button className="text-button" onClick={() => void updater.current?.()}>Reload app</button></div>}
      <main id="main" tabIndex={-1}>
        <div className="page-heading"><div><div className="date-eyebrow">{new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div><h1>{page === 'today' ? <>Kia ora, Ian<span className="greeting-dot">.</span></> : pages[page].label}</h1><p>{page === 'today' ? <>Your work, <strong>in focus.</strong></> : pages[page].subtitle}</p></div><div className="heading-action">{page === 'today' && <span className="day-progress"><CircleCheck size={17} /><strong>{completedToday}</strong> completed today</span>}{installPrompt && <button className="button secondary install-button" onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}><Download size={16} />Install app</button>}</div></div>
        <div className="demo-notice"><span className="demo-label">DEMO</span><span>A space to try things out. Fictional tasks, saved on this device. Please keep sensitive information out.</span><button className="text-button" onClick={() => setSettings(true)}>Connections<ArrowUpRight size={13} /></button></div>
        <form className="quick-capture" onSubmit={e => void quickCapture(e)}><Plus size={23} aria-hidden="true" /><input ref={captureRef} aria-label="Quick capture task" value={capture} onChange={e => setCapture(e.target.value)} maxLength={500} placeholder="Add a task… clear your head, capture the next step." disabled={loading || !!loadError || busy} /><span className="capture-hint">Press <kbd>Enter ↵</kbd></span><button type="button" className="assistant-capture-button" aria-label="Capture with ChatGPT" onClick={() => openAssistant()} disabled={loading || !!loadError || busy}><Sparkles size={16} /><span>Talk it through</span></button><button type="submit" className="capture-submit" aria-label="Add task" disabled={!capture.trim() || busy}><ArrowRight size={18} /></button></form>
        {!loading && !loadError && <div className="capture-context"><label>Capture into<select aria-label="Quick capture workstream" value={currentCaptureWorkstream} onChange={e => { setCaptureWorkstream(e.target.value); if (filters.workstream) setFilters(f => ({ ...f, workstream: e.target.value })); }}>{workstreams.map(w => <option key={w}>{w}</option>)}</select></label><span>Captured tasks appear in Focus Today.</span></div>}
        {loading ? <div className="loading-state" role="status"><span className="loading-ring" />Getting your workspace ready…</div> : loadError ? <div className="empty-state" role="alert"><WifiOff size={30} /><h2>We couldn’t open your workspace</h2><p>{loadError}</p><button className="button primary" onClick={() => void load()}>Try again</button></div> : <>
          {page === 'today' && <div className="today-sections">
            {section('Focus Today', focused, <Star size={18} />, 'focus-section', 'A clear space for your priorities. Add a task above or use the star beside any task.', <span className="section-hint">Chosen by you</span>)}
            {section('Due Today', active.filter(t => t.dueDate === today && t.focusDate !== today && t.status !== 'waiting'), <CalendarDays size={18} />, '', 'Nothing else due today. A little breathing room.')}
            {section('Overdue', active.filter(t => t.dueDate && t.dueDate < today && t.focusDate !== today && t.status !== 'waiting').sort(byDue), <Clock3 size={18} />, 'overdue-section')}
            {section('Waiting / Follow-up', waitingToday, <Clock3 size={18} />, '', undefined, <button className="text-button" onClick={() => navigate('waiting')}>View all<ArrowUpRight size={14} /></button>)}
            {section('Upcoming', active.filter(t => t.dueDate && t.dueDate > today && t.focusDate !== today && t.status !== 'waiting').sort(byDue).slice(0, 3), <CalendarDays size={18} />, '', undefined, <button className="text-button" onClick={() => navigate('upcoming')}>Look ahead<ArrowUpRight size={14} /></button>)}
            <div className="today-footer"><span className="footer-plus">+</span><p>One task at a time. You’re moving things forward.</p><span>EarnLearn Work Hub</span></div>
          </div>}
          {(page === 'all' || page === 'search' || page === 'completed') && <>
            <Filters value={filters} change={setFilters} workstreams={workstreams} history={page === 'completed'} searchPage={page === 'search'} />
            {(() => {
              const list = tasks.filter(t => (page !== 'completed' || t.status === 'completed') && matches(t)).sort(page === 'completed' ? (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : byDue);
              return <><div className="result-heading"><h2>{page === 'completed' ? 'Your work history' : page === 'search' ? 'Search results' : 'Your tasks'}<span className="section-count">{list.length}</span></h2><span>{page === 'completed' ? 'Completed, never deleted' : 'All sources, one view'}</span></div>{list.length ? <div className="task-list">{list.map(t => row(t, page === 'completed' || t.status === 'completed'))}</div> : <Empty title={page === 'completed' ? 'Your story is still being written' : 'No tasks found'} text="Try adjusting your filters, or capture a new task above." />}</>;
            })()}
          </>}
          {page === 'upcoming' && (() => {
            const list = active.filter(t => t.dueDate).sort(byDue);
            return list.length ? ['Overdue', 'Today', 'Tomorrow', 'This week', 'Next week', 'Later'].map(group => section(group, list.filter(t => upcomingGroup(t.dueDate!, today) === group), <CalendarDays size={17} />)) : <Empty title="Room for what’s next" text="Add a due date to a task and it will appear in your timeline." />;
          })()}
          {page === 'waiting' && (() => {
            const waiting = active.filter(t => t.status === 'waiting');
            return waiting.length ? <><div className="waiting-intro"><Clock3 size={20} /><p>You’ve done your part. Keep track of what comes next.</p></div>{waiting.sort((a, b) => (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999')).map(t => <section className="waiting-card" key={t.id}><div className="waiting-card-heading"><span><span className={`status-dot ${t.followUpDate && t.followUpDate <= today ? 'follow-up' : ''}`} />Waiting on <strong>{t.waitingFor || 'a response'}</strong></span><span className={t.followUpDate && t.followUpDate <= today ? 'follow-up-date' : ''}>{t.followUpDate ? `${t.followUpDate <= today ? 'Follow up · ' : 'Follow up '}${formatDate(t.followUpDate, today)}` : 'No follow-up set'}</span></div>{row(t)}{t.notes && <p className="waiting-context">{t.notes}</p>}</section>)}</> : <Empty title="Nothing waiting on someone else" text="Set a task to Waiting and add a follow-up date to keep it in view." />;
          })()}
          {page === 'workstreams' && <Workstreams names={workstreams} tasks={tasks} busy={busy} capture={openAssistant} open={name => { navigate('all'); setCaptureWorkstream(name); setFilters({ ...emptyFilters, workstream: name }); }} add={name => act(async () => { await demo.addWorkstream(name); await refresh(); setToast({ message: 'Workstream added.' }); })} rename={(from, to) => act(async () => { await demo.renameWorkstream(from, to); await refresh(); setToast({ message: 'Workstream renamed. Tasks updated.' }); })} remove={name => act(async () => { await demo.removeWorkstream(name); await refresh(); setToast({ message: 'Empty workstream removed.' }); })} />}
        </>}
      </main>
    </div>
    {selected && <TaskDrawer key={selected.id} task={selected} workstreams={workstreams} today={today} fields={hub.provider(selected.provider).capabilities.writableFields} save={save} close={closeDrawer} busy={busy} />}
    {assistantOpen && <CaptureAssistant note={assistantNote} setNote={setAssistantNote} initialWorkstream={assistantWorkstream} workstreams={workstreams} today={today} close={closeAssistant} capture={drafts => act(async () => { const created = await hub.capture(drafts); await refresh(); setCapture(''); const focusCount = created.filter(task => task.focusDate === today).length; setToast({ message: `${created.length} task${created.length === 1 ? '' : 's'} captured. ${focusCount} in Focus Today.` }); })} />}
    {settings && <Settings close={closeSettings} offline={offline} reset={() => act(async () => { await demo.reset(); await refresh(); setFilters({ ...emptyFilters }); setToast({ message: 'Fictional demo workspace restored.' }); })} />}
    {toast && <div className="toast" role={toast.error ? 'alert' : 'status'}>{toast.error ? <TriangleAlert size={17} /> : <Check size={17} />}<span>{toast.message}</span>{toast.task && <button onClick={() => { setSelected(toast.task!); setToast(null); }}>Add details</button>}{toast.undo && <button disabled={busy} onClick={() => void act(async () => { await toast.undo!(); setToast(null); })}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
  </div>;
}

function MobileNavFocus({ navRef, close }: { navRef: RefObject<HTMLElement | null>; close: () => void }) {
  useDialog(navRef, close);
  return null;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Inbox size={28} /><Sparkles size={13} /></span><h2>{title}</h2><p>{text}</p></div>;
}
