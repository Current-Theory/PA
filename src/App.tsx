import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Sun, ListTodo, CalendarDays, Clock3, CircleCheck, Layers, Search, Settings as SettingsIcon, ChevronRight, Plus, ArrowUpRight, Menu, X, Pin, ArrowRight, Check, WifiOff, Download, RefreshCw, Inbox, MessageSquare, TriangleAlert, FolderOpen, Trash2 } from 'lucide-react';
import { todayTasks } from './lib/today';
import { registerPwa } from './lib/pwa';
import { WorkspaceProvider } from './providers/WorkspaceProvider';
import { TaskHub } from './providers/TaskHub';
import { type Task, type TaskPatch, type Project, searchableText } from './lib/model';
import { addDays, dateKey, upcomingGroup } from './lib/dates';
import { TaskRow } from './components/TaskRow';
import { TaskDrawer } from './components/TaskDrawer';
import { Filters } from './components/Filters';
import { emptyFilters, type FiltersState } from './lib/filters';
import { Settings } from './components/Settings';
import { Workstreams } from './components/Workstreams';
import { useDialog } from './lib/useDialog';
import { AssistantConversation, AssistantPanel } from './components/AssistantConversation';
import { DailyNote } from './components/DailyNote';
import { Projects } from './components/Projects';
import { AssistantEngine } from './assistant/engine';
import type { Conversation } from './assistant/contracts';

const workspace = new WorkspaceProvider();
const hub = new TaskHub([workspace], 'local');
const assistantEngine = new AssistantEngine(workspace);
const pages = {
  today: { label: 'Today', icon: Sun },
  assistant: { label: 'Conversations', icon: MessageSquare },
  all: { label: 'Tasks', icon: ListTodo },
  upcoming: { label: 'Upcoming', icon: CalendarDays },
  waiting: { label: 'Waiting', icon: Clock3 },
  completed: { label: 'Completed', icon: CircleCheck },
  projects: { label: 'Projects', icon: FolderOpen },
  workstreams: { label: 'Workstreams', icon: Layers },
  trash: { label: 'Trash', icon: Trash2 },
  search: { label: 'Search', icon: Search }
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
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [noteDate, setNoteDate] = useState(dateKey());
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectFilter, setProjectFilter] = useState('');
  const [trash, setTrash] = useState<Task[]>([]);
  const [conversation, setConversation] = useState<Conversation>({ messages: [], recentTaskIds: [], recentProjectIds: [] });
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
    const [nextTasks, snapshot] = await Promise.all([hub.list(), workspace.snapshot()]);
    setTasks(nextTasks); setWorkstreams(snapshot.workstreams); setProjects(snapshot.projects ?? []);
    setDailyNotes(snapshot.dailyNotes ?? {});
    setTrash(snapshot.tasks.filter(task => task.deletedAt)); setConversation(snapshot.conversation ?? { messages: [], recentTaskIds: [], recentProjectIds: [] });
  }, []);
  const load = useCallback(async () => {
    setLoading(true); setLoadError('');
    try { await refresh(); } catch (error) { setLoadError(error instanceof Error ? error.message : 'Could not load the workspace.'); }
    finally { setLoading(false); }
  }, [refresh]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const listener = () => { setPage(readPage()); setFilters({ ...emptyFilters }); setMobileNav(false); setSelected(null); setAssistantOpen(false); setProjectFilter(''); };
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
    setPage(next); setFilters({ ...emptyFilters }); setMobileNav(false); setSelected(null); setAssistantOpen(false); setProjectFilter('');
    window.history.replaceState(null, '', `#${next}`);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if (selected || settings || assistantOpen) return;
      const target = event.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((event.ctrlKey || event.metaKey) && event.key === 'k') { event.preventDefault(); navigate('search'); setTimeout(() => document.getElementById('task-search')?.focus(), 50); }
      else if (!typing && !event.ctrlKey && !event.metaKey && event.key.toLowerCase() === 'n') { event.preventDefault(); (page === 'assistant' ? document.getElementById('assistant-message') : captureRef.current ?? document.getElementById('task-search'))?.focus(); }
      else if (event.key === 'Escape') setMobileNav(false);
    };
    window.addEventListener('keydown', shortcut); return () => window.removeEventListener('keydown', shortcut);
  }, [navigate, selected, settings, assistantOpen, page]);
  const act = async (operation: () => Promise<void>): Promise<boolean> => {
    if (mutationLock.current) return false;
    mutationLock.current = true; setBusy(true);
    try { await operation(); return true; }
    catch (error) { setToast({ error: true, message: error instanceof Error ? error.message : 'Something went wrong. Please retry.' }); return false; }
    finally { mutationLock.current = false; setBusy(false); }
  };
  const save = (task: Task, patch: TaskPatch): Promise<boolean> => act(async () => {
    await hub.update(task, patch); await refresh(); setToast({ message: patch.status === 'completed' ? 'Task completed.' : 'Changes saved.' });
  });
  const complete = (task: Task) => {
    if (task.status === 'completed') { void save(task, { status: 'notStarted' }); return; }
    void act(async () => {
      const updated = await hub.update(task, { status: 'completed' });
      setFinishing(ids => [...ids, task.id]);
      await new Promise(resolve => setTimeout(resolve, 320));
      setFinishing(ids => ids.filter(id => id !== task.id));
      await refresh();
      setToast({ message: 'Task completed.', task: updated, undo: async () => {
        await hub.update(updated, { status: task.status, completedAt: task.completedAt }); await refresh();
      } });
    });
  };
  const focus = (task: Task) => void save(task, { focusDate: task.focusDate === today ? null : today });
  const currentCaptureWorkstream = workstreams.includes(captureWorkstream) ? captureWorkstream : workstreams[0];
  const openAssistant = (workstream = currentCaptureWorkstream) => {
    setAssistantWorkstream(workstream);
    setAssistantOpen(true);
  };
  const quickCapture = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!capture.trim()) return;
    await act(async () => {
      const task = await hub.create(capture, currentCaptureWorkstream);
      setCapture(''); await refresh();
      setToast({ message: 'Task added to Today.', task });
    });
  };
  const active = tasks.filter(t => t.status !== 'completed');
  const todaysWork = todayTasks(tasks, today);
  const completedToday = tasks.filter(t => t.status === 'completed' && t.completedAt && dateKey(new Date(t.completedAt)) === today).length;
  const counts: Partial<Record<Page, number>> = { today: todaysWork.count, waiting: active.filter(t => t.status === 'waiting').length };
  const matches = (task: Task) => {
    if (projectFilter && task.projectId !== projectFilter) return false;
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
  const noteMatches = filters.text.trim() ? Object.entries({ ...dailyNotes, ...noteDrafts }).filter(([date, text]) => `${date} ${text}`.toLocaleLowerCase().includes(filters.text.toLocaleLowerCase())).sort(([a], [b]) => b.localeCompare(a)) : [];
  const byDue = (a: Task, b: Task) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999');
  const row = (task: Task, history = false, showWaitingContext = true) => <TaskRow key={task.id} task={task} today={today} onOpen={setSelected} onComplete={complete} onFocus={focus} busy={busy} finishing={finishing.includes(task.id)} history={history} showWaitingContext={showWaitingContext} />;
  const section = (title: string, items: Task[], icon: ReactNode, className = '', empty?: string, action?: ReactNode) => items.length || empty ? <section className={`task-section ${className}`} key={title}><div className="section-header"><h2>{icon}{title}<span className="section-count">{items.length}</span></h2>{action}</div>{items.length ? <div className="task-list">{items.map(t => row(t))}</div> : <div className="section-empty">{empty}</div>}</section> : null;
  const navLink = (key: Page) => {
    const Icon = pages[key].icon;
    return <a href={`#${key}`} className={`nav-item ${page === key ? 'active' : ''}`} key={key} aria-current={page === key ? 'page' : undefined} onClick={event => { event.preventDefault(); navigate(key); }}><Icon size={19} strokeWidth={1.7} /><span>{pages[key].label}</span>{counts[key] !== undefined && <span className="nav-count" title={key === 'today' ? 'Unique tasks surfaced on Today' : 'Tasks waiting for a response'}>{counts[key]}</span>}{key === 'search' && <kbd>Ctrl+K</kbd>}</a>;
  };
  return <div className="app-shell">
    <a className="skip-link" href="#main">Skip to workspace</a>
    {mobileNav && <div className="mobile-backdrop" onClick={() => setMobileNav(false)} aria-hidden="true" />}
    {mobileNav && <MobileNavFocus navRef={navRef} close={closeMobileNav} />}
    <aside id="navigation" ref={navRef} tabIndex={-1} role={mobileNav ? 'dialog' : undefined} aria-modal={mobileNav ? true : undefined} className={`sidebar ${mobileNav ? 'is-open' : ''}`} aria-label="Workspace navigation">
      <a className="brand" href="#today" onClick={e => { e.preventDefault(); navigate('today'); }} aria-label="EarnLearn Work Hub home"><span className="brand-word"><span>Earn</span><span>Learn</span><b aria-hidden="true">+</b></span><span className="brand-caption">WORK HUB</span></a>
      <button className="mobile-close icon-button" aria-label="Close navigation" onClick={() => setMobileNav(false)}><X size={22} /></button>
      <nav aria-label="Main">{(['today', 'assistant', 'all', 'upcoming', 'waiting', 'completed', 'projects', 'workstreams'] as Page[]).map(navLink)}</nav>
      <div className="sidebar-bottom"><nav aria-label="Tools">{navLink('search')}{navLink('trash')}<button className="nav-item" onClick={() => { setSettings(true); setMobileNav(false); }}><SettingsIcon size={19} strokeWidth={1.7} /><span>Settings</span></button></nav><button className="sync-status" onClick={() => setSettings(true)}><span className={`status-dot ${offline ? 'offline' : ''}`} /><span>{offline ? 'Offline' : 'Saved on this device'}<small>{'No cloud sync'}</small></span><ChevronRight size={14} /></button></div>
    </aside>
    <div className="workspace">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobileNav} aria-controls="navigation" onClick={() => setMobileNav(!mobileNav)}><Menu size={21} /></button><strong>{pages[page].label}</strong></div><div className="topbar-right"><button className="text-button connections-link" onClick={() => setSettings(true)}>Connections</button><span className="topbar-divider" /><span className="profile-name">Ian Barnes</span><span className="avatar" aria-label="Ian Barnes">IB</span></div></header>
      {offline && <div className="connection-banner" role="status"><WifiOff size={16} />You’re offline. Conversations need an Internet connection.</div>}
      {updateAvailable && <div className="connection-banner"><RefreshCw size={16} />An update is ready. Save any open task before reloading.<button className="text-button" onClick={() => void updater.current?.()}>Reload app</button></div>}
      <main id="main" data-page={page} tabIndex={-1}>
        <div className="page-heading"><div>{page === 'today' && <div className="date-eyebrow">{new Intl.DateTimeFormat('en-NZ', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</div>}<h1>{page === 'today' ? <>Kia ora, Ian<span className="greeting-dot">.</span></> : pages[page].label}</h1></div><div className="heading-action">{page === 'today' && completedToday > 0 && <span className="day-progress"><CircleCheck size={17} /><strong>{completedToday}</strong> completed today</span>}{installPrompt && <button className="button secondary install-button" onClick={async () => { await installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null); }}><Download size={16} />Install app</button>}</div></div>
        {page !== 'assistant' && page !== 'completed' && <form className="quick-capture" aria-label="Add task" onSubmit={e => void quickCapture(e)}><Plus size={21} aria-hidden="true" /><input ref={captureRef} aria-label="Quick capture task" value={capture} onChange={e => setCapture(e.target.value)} maxLength={500} placeholder="Add task…" disabled={loading || !!loadError || busy} /><label className="capture-destination">Add to:<select aria-label="Quick capture workstream" value={currentCaptureWorkstream ?? ''} disabled={loading || !!loadError || busy} onChange={e => setCaptureWorkstream(e.target.value)}>{workstreams.map(w => <option key={w}>{w}</option>)}</select></label>{capture.trim() && <button type="submit" className="capture-submit" aria-label="Add task" disabled={busy || loading || !!loadError}><ArrowRight size={18} /></button>}</form>}
        {loading ? <div className="loading-state" role="status"><span className="loading-ring" />Loading workspace…</div> : loadError ? <div className="empty-state" role="alert"><WifiOff size={30} /><h2>Could not open workspace</h2><p>{loadError}</p><button className="button primary" onClick={() => void load()}>Try again</button></div> : <>
          {page === 'assistant' && <AssistantConversation conversation={conversation} engine={assistantEngine} workspace={workspace} workstream={currentCaptureWorkstream} changed={refresh} openTask={setSelected} />}
          {page === 'projects' && <Projects projects={projects} tasks={tasks} workstreams={workstreams} busy={busy} create={(input) => act(async () => { await workspace.createProject(input); await refresh(); setToast({ message: 'Project created.' }); })} openTasks={id => { navigate('all'); setProjectFilter(id); }} discuss={project => { if (project.id) void workspace.saveConversation({ ...conversation, recentProjectIds: [project.id] }).then(refresh); openAssistant(project.workstream || currentCaptureWorkstream); }} />}
          {page === 'trash' && <div className="task-list trash-list">{trash.length ? trash.map(task => <article className="trash-row" key={task.id}><div><h2>{task.title}</h2><p>{task.workstream} · {task.status === 'completed' ? 'Completed' : 'Deleted task'}</p></div><button className="button secondary" disabled={busy} onClick={() => void act(async () => { await workspace.restoreTask(task.id); await refresh(); setToast({ message: 'Task restored.' }); })}>Restore task</button></article>) : <Empty title="Trash is empty" text="Deleted tasks stay recoverable here." />}</div>}
          <div className={page === 'today' ? 'today-layout' : 'notebook-hidden'}>
          <DailyNote date={noteDate} today={today} notes={{ ...dailyNotes, ...noteDrafts }} workspace={workspace} change={(date, text) => setNoteDrafts(notes => ({ ...notes, [date]: text }))} saved={(date, text) => { setDailyNotes(notes => ({ ...notes, [date]: text })); setNoteDrafts(drafts => { if (drafts[date] !== text) return drafts; const next = { ...drafts }; delete next[date]; return next; }); }} selectDate={setNoteDate} visible={page === 'today'} />
          {page === 'today' && <div className="today-sections">
            {section("Today's focus", todaysWork.focus, <Pin size={18} />, 'focus-section', 'No tasks selected for today.')}
            {section('Overdue', todaysWork.overdue, <Clock3 size={18} />, 'overdue-section')}
            {section('Due today', todaysWork.due, <CalendarDays size={18} />, '', 'Nothing else due today.')}
            {section('Waiting / follow-up', todaysWork.followUp, <Clock3 size={18} />, '', undefined, <button className="text-button" onClick={() => navigate('waiting')}>View all<ArrowUpRight size={14} /></button>)}

          </div>}
          </div>
          {(page === 'all' || page === 'search' || page === 'completed') && <>
            {projectFilter && <div className="project-filter-chip">Project: {projects.find(project => project.id === projectFilter)?.name}<button className="text-button" onClick={() => setProjectFilter('')}>Clear project filter<X size={12} /></button></div>}
            <Filters value={filters} change={setFilters} workstreams={workstreams} history={page === 'completed'} searchPage={page === 'search'} />
            {page === 'search' && noteMatches.length > 0 && <section className="note-search" aria-label="Note search results"><h2>Daily Notes</h2>{noteMatches.map(([date, text]) => <button className="note-search-result" key={date} onClick={() => { setNoteDate(date); navigate('today'); }}><strong>{date}</strong><span>{text.slice(0, 200)}</span></button>)}</section>}
            {(() => {
              const list = tasks.filter(t => (page !== 'completed' || t.status === 'completed') && matches(t)).sort(page === 'completed' ? (a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? '') : byDue);
              return <><div className="result-heading"><span>{list.length} {page === 'completed' ? 'completed' : 'matching'} task{list.length === 1 ? '' : 's'}</span></div>{list.length ? <div className="task-list">{list.map(t => row(t, page === 'completed' || t.status === 'completed'))}</div> : <Empty title={page === 'completed' ? 'No completed tasks' : 'No tasks found'} text="Try changing your filters." />}</>;
            })()}
          </>}
          {page === 'upcoming' && (() => {
            const list = active.filter(t => t.dueDate).sort(byDue);
            return list.length ? ['Overdue', 'Today', 'Tomorrow', 'This week', 'Next week', 'Later'].map(group => section(group, list.filter(t => upcomingGroup(t.dueDate!, today) === group), <CalendarDays size={17} />)) : <Empty title="No scheduled tasks" text="Tasks with due dates appear here." />;
          })()}
          {page === 'waiting' && (() => {
            const waiting = active.filter(t => t.status === 'waiting').sort((a, b) => (a.followUpDate ?? '9999').localeCompare(b.followUpDate ?? '9999'));
            const groups = new Map<string, Task[]>();
            for (const task of waiting) {
              const person = task.waitingFor.trim() || 'Unspecified';
              const key = person.toLocaleLowerCase();
              const group = groups.get(key) ?? []; group.push(task); groups.set(key, group);
            }
            return waiting.length ? [...groups.values()].map(group => <section className="waiting-group" key={group[0].waitingFor.trim().toLocaleLowerCase()}><h2>Waiting on <span>{group[0].waitingFor.trim() || 'Unspecified'}</span><span className="section-count">{group.length}</span></h2><div className="task-list">{group.map(task => row(task, false, false))}</div></section>) : <Empty title="Nothing waiting" text="Tasks marked Waiting appear here." />;
          })()}
          {page === 'workstreams' && <Workstreams names={workstreams} tasks={tasks} busy={busy} capture={openAssistant} open={name => { navigate('all'); setCaptureWorkstream(name); setFilters({ ...emptyFilters, workstream: name }); }} add={name => act(async () => { await workspace.addWorkstream(name); await refresh(); setToast({ message: 'Workstream added.' }); })} rename={(from, to) => act(async () => { await workspace.renameWorkstream(from, to); await refresh(); setToast({ message: 'Workstream renamed. Tasks updated.' }); })} remove={name => act(async () => { await workspace.removeWorkstream(name); await refresh(); setToast({ message: 'Empty workstream removed.' }); })} />}
        </>}
      </main>
    </div>
    {selected && <TaskDrawer key={selected.id} task={selected} projects={projects} workstreams={workstreams} today={today} fields={hub.capabilities(selected.provider).writableFields} save={save} remove={task => act(async () => { await workspace.trashTask(task); await refresh(); setToast({ message: 'Moved to Trash.', undo: async () => { await workspace.restoreTask(task.id); await refresh(); } }); })} close={closeDrawer} busy={busy} />}
    {assistantOpen && <AssistantPanel close={closeAssistant} conversation={conversation} engine={assistantEngine} workspace={workspace} workstream={assistantWorkstream || currentCaptureWorkstream} changed={refresh} openTask={task => { setAssistantOpen(false); setSelected(task); }} />}
    {settings && <Settings close={closeSettings} offline={offline} backup={async () => { await act(async () => { const state = await workspace.snapshot(); const blob = new Blob([JSON.stringify({ format: 'earnlearn-workspace', version: 2, exportedAt: new Date().toISOString(), tasks: state.tasks, projects: state.projects, dailyNotes: state.dailyNotes ?? {}, workstreams: state.workstreams, events: state.events }, null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `work-hub-backup-${dateKey()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }); }} reset={() => act(async () => { if (assistantEngine.isRunning) throw new Error('Stop the assistant before replacing the workspace.'); await workspace.reset(); setNoteDrafts({}); await refresh(); setFilters({ ...emptyFilters }); setToast({ message: 'Sample workspace restored.' }); })} />}
    {toast && <div className="toast" role={toast.error ? 'alert' : 'status'}>{toast.error ? <TriangleAlert size={17} /> : <Check size={17} />}<span>{toast.message}</span>{toast.task && <button onClick={() => { setSelected(toast.task!); setToast(null); }}>Add details</button>}{toast.undo && <button disabled={busy} onClick={() => void act(async () => { await toast.undo!(); setToast(null); })}>Undo</button>}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setToast(null)}><X size={15} /></button></div>}
  </div>;
}

function MobileNavFocus({ navRef, close }: { navRef: RefObject<HTMLElement | null>; close: () => void }) {
  useDialog(navRef, close);
  return null;
}

function Empty({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Inbox size={24} /></span><h2>{title}</h2><p>{text}</p></div>;
}
