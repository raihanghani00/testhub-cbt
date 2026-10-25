import { useMemo, useState } from 'react';
import type { Attempt, Test } from '../types';
import { I, PatternBadge } from './ui';
import { fmtClock, fmtDate, fmtDuration, maxMarks, totalMinutes, totalQuestions } from '../lib/utils';
import { hasProgress, loadProgress } from '../lib/storage';
import { Avatar, type AccountUser } from './AccountModal';
import type { Role } from '../lib/roles';

interface Props {
  tests: Test[];
  attempts: Attempt[];
  dark: boolean;
  onToggleDark: () => void;
  onCreate: () => void;
  onStart: (t: Test) => void;
  onRestart: (t: Test) => void;
  onDelete: (t: Test) => void;
  onExport: (t: Test) => void;
  onOpenAttempt: (a: Attempt) => void;
  onDeleteAttempt: (a: Attempt) => void;
  initialTab?: 'tests' | 'history';
  user: AccountUser | null;
  role?: Role;
  isAdmin?: boolean;
  pendingCount?: number;
  onAdmin?: () => void;
  onProfile: () => void;
}

export default function Dashboard(p: Props) {
  const [tab, setTab] = useState<'tests' | 'history'>(p.initialTab ?? 'tests');
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');
  const sortedAttempts = useMemo(() => [...p.attempts].sort((a, b) => b.date - a.date), [p.attempts]);
  const filteredTests = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return p.tests;
    return p.tests.filter((t) =>
      t.title.toLowerCase().includes(q) ||
      t.sections.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [p.tests, search]);

  return (
    <div className="min-h-[100dvh] dot-grid">
      {/* Header */}
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer select-none" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="grad-primary w-10 h-10 rounded-xl grid place-items-center text-white shadow-lg shadow-indigo-500/30">
              <I n="check-double" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-lg tracking-tight">
                TestHub <span className="grad-text">CBT</span>
              </div>
              <div className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5">Smart Mock Test Platform</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={p.onToggleDark}
              className="touch-target grid place-items-center rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition"
              aria-label="Toggle dark mode"
            >
              <I n={p.dark ? 'sun' : 'moon'} className={p.dark ? 'text-amber-300' : 'text-slate-600'} />
            </button>
            {p.isAdmin && (
              <button
                onClick={p.onAdmin}
                title="Admin Panel"
                aria-label="Admin Panel"
                className="relative touch-target grid place-items-center rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition active:scale-90"
              >
                <I n="user-shield" className="text-indigo-500 dark:text-indigo-300" />
                {p.pendingCount !== undefined && p.pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold grid place-items-center ring-2 ring-white dark:ring-slate-800 animate-pop">
                    {p.pendingCount > 9 ? '9+' : p.pendingCount}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={p.onCreate}
              className="touch-target grad-primary text-white px-4 rounded-xl font-semibold text-sm flex items-center gap-2 shadow-lg shadow-indigo-500/25 hover:brightness-110 active:scale-95 transition"
            >
              <I n="plus" /> <span>Create</span>
            </button>
            <button
              onClick={p.onProfile}
              aria-label={p.user ? `Account: ${p.user.name}` : 'Log in or sign up'}
              title={p.user ? p.user.name : 'Log in / Sign up'}
              className="relative touch-target grid place-items-center rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition active:scale-90"
            >
              {p.user ? (
                <span className="w-9 h-9 rounded-full ring-2 ring-indigo-400/60 overflow-hidden block"><Avatar user={p.user} /></span>
              ) : (
                <span className="w-9 h-9 rounded-full border border-slate-300 dark:border-slate-600 grid place-items-center text-slate-600 dark:text-slate-300">
                  <I n="user" className="text-sm" />
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* Hero */}
        <section className="relative mt-4 sm:mt-8 rounded-3xl overflow-hidden grad-primary text-white card-shadow-lg animate-fade-up">
          <div className="absolute inset-0 dot-grid-white opacity-60" />
          <div className="absolute -right-24 -top-24 w-80 h-80 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -left-16 -bottom-28 w-72 h-72 rounded-full bg-sky-300/20 blur-3xl" />
          <div className="relative grid lg:grid-cols-[1.3fr_1fr] gap-8 p-5 sm:p-10 lg:p-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/15 text-xs font-semibold backdrop-blur border border-white/20">
                <I n="bolt" className="text-amber-300" /> TCS iON &amp; Eduquity style engine
              </span>
              <h1 className="mt-4 text-3xl sm:text-5xl font-black tracking-tight leading-[1.08]">
                {p.role === 'student' ? (
                  <>Welcome to your <span className="text-sky-200">Student Portal</span></>
                ) : (
                  <>Upload .TXT Questions <span className="text-sky-200">→</span> Instant Test Form</>
                )}
              </h1>
              <p className="mt-4 text-white/80 max-w-xl text-sm sm:text-base">
                {p.role === 'student'
                  ? 'Ready to practice? Select a mock test below or load a .json test file provided by your teacher to begin.'
                  : 'Turn a plain text file into a full-length computer-based mock test with timers, sections, review marking and a deep performance report.'}
              </p>
              <button
                onClick={p.onCreate}
                className="mt-5 sm:mt-7 touch-target inline-flex items-center gap-2.5 bg-white text-indigo-700 font-bold px-6 rounded-2xl shadow-xl hover:scale-[1.03] active:scale-95 transition"
              >
                <I n="file-import" /> {p.role === 'student' ? 'Load Test File (.JSON)' : 'Import Questions'}
              </button>
            </div>
            <ul className="hidden md:grid md:grid-cols-2 lg:grid-cols-1 gap-2.5">
              {(p.role === 'student'
                ? [
                    ['rocket', 'Practice mock tests', 'Start any test shared with you'],
                    ['file-import', 'Load teacher .json', 'Import a ready-made test file'],
                    ['floppy-disk', 'Auto-save & resume', 'Pause any time, continue later'],
                    ['chart-line', 'Deep analytics', 'Sectional scores, time & solutions'],
                  ]
                : [
                    ['square-root-variable', 'KaTeX math rendering', 'Write $x^2$ or $\\frac{a}{b}$ directly'],
                    ['layer-group', 'TCS & Eduquity patterns', 'Global or sectional timers'],
                    ['floppy-disk', 'Auto-save & resume', 'Pause any time, continue later'],
                    ['chart-line', 'Deep analytics', 'Sectional scores, time & solutions'],
                  ]
              ).map(([ic, t, d]) => (
                <li key={t} className="flex items-center gap-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-4 py-3">
                  <span className="grid place-items-center w-9 h-9 rounded-xl bg-white/20 text-sm shrink-0"><I n={ic} /></span>
                  <span className="leading-tight">
                    <span className="block text-sm font-bold">{t}</span>
                    <span className="block text-xs text-white/70">{d}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Tabs */}
        <div id="mock-tests" className="mt-8 scroll-mt-20 flex items-center justify-between gap-2 sm:gap-3">
          <div className="inline-flex p-1 rounded-2xl glass card-shadow shrink-0">
            {([
              ['tests', 'Mock Tests', 'rectangle-list', p.tests.length],
              ['history', 'Test History', 'clock-rotate-left', p.attempts.length],
            ] as const).map(([k, label, ic, n]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`touch-target px-3 py-2 text-xs sm:px-4 sm:text-sm rounded-xl font-semibold flex items-center gap-1.5 sm:gap-2 whitespace-nowrap transition ${
                  tab === k ? 'grad-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
                }`}
              >
                <I n={ic} className="text-xs" /> <span className="whitespace-nowrap">{label}</span>
                <span className={`text-[10px] sm:text-[11px] px-1.5 py-0.5 rounded-md ${tab === k ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700'}`}>{n}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => { setSearchOpen((v) => !v); if (searchOpen) setSearch(''); }}
            aria-label="Search mock tests"
            aria-expanded={searchOpen}
            className={`touch-target w-9 h-9 sm:w-10 sm:h-10 shrink-0 flex items-center justify-center rounded-2xl glass card-shadow transition active:scale-90 ${searchOpen ? 'grad-primary text-white' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'}`}
          >
            <I n={searchOpen ? 'xmark' : 'magnifying-glass'} className="text-sm" />
          </button>
        </div>

        {searchOpen && (
          <div className="mt-3 animate-fade-up">
            <div className="relative">
              <I n="magnifying-glass" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search mock tests by name..."
                className="w-full h-12 pl-11 pr-10 rounded-2xl glass card-shadow text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 placeholder:text-slate-400"
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); }}
                  aria-label="Clear search"
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                >
                  <I n="xmark" className="text-xs" />
                </button>
              )}
            </div>
          </div>
        )}

        {tab === 'tests' ? (
          p.tests.length === 0 ? (
            <Empty icon="folder-open" title="No tests yet" text="Import a .txt file or load the sample to create your first mock test." action="Create a test" onAction={p.onCreate} />
          ) : filteredTests.length === 0 ? (
            <Empty icon="magnifying-glass" title="No matches found" text={`No mock tests match "${search}". Try a different name or subject.`} />
          ) : (
            <div className="mt-5 grid md:grid-cols-2 xl:grid-cols-3 gap-5">
              {filteredTests.map((t, i) => (
                <TestCard key={t.id} {...p} test={t} index={i} />
              ))}
            </div>
          )
        ) : sortedAttempts.length === 0 ? (
          <Empty icon="clock-rotate-left" title="No attempts yet" text="Finish a test and your performance timeline will appear here." />
        ) : (
          <ol className="mt-6 relative ml-3 sm:ml-4 border-l-2 border-slate-200 dark:border-slate-700 space-y-5">
            {sortedAttempts.map((a, i) => (
              <HistoryItem key={a.id} a={a} i={i} onOpen={() => p.onOpenAttempt(a)} onDelete={() => p.onDeleteAttempt(a)} />
            ))}
          </ol>
        )}
      </main>
    </div>
  );
}

function Empty({ icon, title, text, action, onAction }: { icon: string; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mt-5 glass card-shadow rounded-3xl py-14 px-6 text-center animate-fade-up">
      <div className="mx-auto w-16 h-16 rounded-2xl grid place-items-center bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 text-2xl">
        <I n={icon} />
      </div>
      <h3 className="mt-4 text-lg font-bold">{title}</h3>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 max-w-sm mx-auto">{text}</p>
      {action && (
        <button onClick={onAction} className="mt-5 touch-target grad-primary text-white px-5 rounded-xl font-semibold text-sm">
          <I n="plus" className="mr-2" />{action}
        </button>
      )}
    </div>
  );
}

function TestCard({
  test, index, attempts, onStart, onRestart, onExport, onDelete,
}: { test: Test; index: number; attempts: Attempt[] } & Props) {
  const [menu, setMenu] = useState(false);
  const paused = hasProgress(test.id);
  const prog = paused ? loadProgress(test.id) : null;
  const answered = prog ? Object.values(prog.qs).filter((s) => s.sel !== null).length : 0;
  const last = useMemo(
    () => attempts.filter((a) => a.testId === test.id).sort((a, b) => b.date - a.date)[0],
    [attempts, test.id],
  );
  const stats: [string, string | number, string][] = [
    ['Questions', totalQuestions(test), 'circle-question'],
    ['Marks', maxMarks(test), 'award'],
    ['Timer', `${totalMinutes(test)}m`, 'clock'],
  ];
  return (
    <article
      className="group glass card-shadow rounded-3xl p-5 flex flex-col hover:-translate-y-1 hover:card-shadow-lg transition duration-300 animate-fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 70}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <PatternBadge pattern={test.pattern} />
          {paused && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300">
              <I n="pause" className="text-[9px]" /> Paused · {answered}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0 relative">
          <button
            onClick={() => setMenu((m) => !m)}
            aria-label="More options"
            aria-expanded={menu}
            className="w-9 h-9 grid place-items-center rounded-xl text-slate-500 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition active:scale-90"
          >
            <I n="ellipsis-vertical" className="text-sm" />
          </button>
          {menu && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-10 z-40 w-48 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 card-shadow-lg p-1.5 animate-pop">
                <button
                  onClick={() => { setMenu(false); onRestart(test); }}
                  className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <I n="rotate-right" className="text-slate-400 w-4" /> Restart test
                </button>
                <button
                  onClick={() => { setMenu(false); onExport(test); }}
                  className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                >
                  <I n="file-arrow-down" className="text-slate-400 w-4" /> Download JSON
                </button>
                <button
                  onClick={() => { setMenu(false); onDelete(test); }}
                  className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
                >
                  <I n="trash-can" className="w-4" /> Delete test
                </button>
              </div>
            </>
          )}
        </div>
      </div>
      <h3 className="mt-2 text-lg font-bold leading-snug line-clamp-2">{test.title}</h3>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {test.sections.map((s) => (
          <span key={s.name} className="px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-700/60 dark:text-slate-300">
            {s.name} · {s.questions.length}
          </span>
        ))}
      </div>

      {last && (
        <div className="mt-3 flex items-center justify-between rounded-2xl px-3.5 py-2.5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20">
          <div className="text-xs">
            <div className="text-emerald-700 dark:text-emerald-300 font-semibold">Last attempt</div>
            <div className="text-slate-500 dark:text-slate-400">{fmtDate(last.date)}</div>
          </div>
          <div className="text-right">
            <div className="font-extrabold text-emerald-700 dark:text-emerald-300">{last.score}<span className="text-xs font-semibold opacity-70"> / {last.maxScore}</span></div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400">{last.accuracy}% accuracy</div>
          </div>
        </div>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        {stats.map(([l, v, ic]) => (
          <div key={l} className="rounded-2xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 py-2.5 text-center">
            <I n={ic} className="text-[11px] text-indigo-500" />
            <div className="font-bold text-base leading-tight mt-0.5">{v}</div>
            <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">{l}</div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex items-center gap-2 pt-1 mt-auto">
        <button
          onClick={() => onStart(test)}
          className={`touch-target flex-1 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 hover:brightness-110 active:scale-[0.97] transition ${paused ? 'bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg shadow-orange-500/25' : 'grad-primary shadow-lg shadow-indigo-500/25'}`}
        >
          <I n={paused ? 'play' : 'rocket'} className="text-xs" /> {paused ? 'Resume' : last ? 'Start Again' : 'Start Test'}
        </button>
        {paused && <IconBtn icon="rotate-right" label="Restart (discard paused progress)" onClick={() => onRestart(test)} />}
      </div>
    </article>
  );
}

function IconBtn({ icon, label, onClick, danger }: { icon: string; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`touch-target grid place-items-center rounded-xl border transition active:scale-90 ${
        danger
          ? 'border-rose-200 text-rose-500 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10'
          : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <I n={icon} className="text-sm" />
    </button>
  );
}

function HistoryItem({ a, i, onOpen, onDelete }: { a: Attempt; i: number; onOpen: () => void; onDelete: () => void }) {
  const pct = a.maxScore > 0 ? Math.max(0, Math.min(100, (a.score / a.maxScore) * 100)) : 0;
  const tone = a.accuracy >= 75 ? 'emerald' : a.accuracy >= 45 ? 'amber' : 'rose';
  const toneCls = {
    emerald: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
    amber: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300',
    rose: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300',
  }[tone];
  return (
    <li className="relative pl-6 sm:pl-8 animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
      <span className="absolute -left-[9px] top-6 w-4 h-4 rounded-full grad-primary ring-4 ring-slate-50 dark:ring-slate-900" />
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => e.key === 'Enter' && onOpen()}
        className="w-full text-left glass card-shadow rounded-3xl p-4 sm:p-5 hover:-translate-y-0.5 hover:card-shadow-lg transition cursor-pointer"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium min-w-0">
              <I n="calendar" className="text-[10px]" /> {fmtDate(a.date)}
              <span className="opacity-50">•</span>
              <I n="clock" className="text-[10px]" /> {fmtClock(a.date)}
            </div>
            <div className="flex items-center gap-2 shrink-0">
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${toneCls}`}>
              <I n="bullseye" className="mr-1 text-[10px]" />{a.accuracy}%
            </span>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              aria-label="Delete attempt"
              className="w-9 h-9 grid place-items-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition"
            >
              <I n="xmark" />
            </button>
            </div>
          </div>
          <h4 className="w-full font-bold text-base sm:text-lg leading-snug whitespace-normal break-words">{a.title}</h4>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            ['Score', `${a.score}/${a.maxScore}`, 'text-indigo-600 dark:text-indigo-300'],
            ['Correct', a.correct, 'text-emerald-600 dark:text-emerald-400'],
            ['Wrong', a.wrong, 'text-rose-600 dark:text-rose-400'],
            ['Time', fmtDuration(a.timeTaken), 'text-slate-700 dark:text-slate-200'],
          ].map(([l, v, c]) => (
            <div key={String(l)} className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700/50 py-2 px-1 text-center">
              <div className={`font-extrabold text-sm sm:text-base ${c}`}>{v}</div>
              <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400 font-semibold">{l}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full grad-primary transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 w-10 text-right">{Math.round(pct)}%</span>
          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hidden sm:inline">View report <I n="arrow-right" className="text-[10px]" /></span>
        </div>
      </div>
    </li>
  );
}
