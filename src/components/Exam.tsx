import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Attempt, QMap, Test } from '../types';
import { I, Modal, PatternBadge, RichText, Toast, ZoomImg } from './ui';
import { StatusChip, STATUS_META } from './status';
import { LETTERS, computeAttempt, fmtTime, initialTimers } from '../lib/utils';
import { getName, loadProgress, saveProgress } from '../lib/storage';
import { clearProgressEverywhere, isSignedIn, pushProgress } from '../lib/cloud';

interface Props {
  test: Test;
  resume: boolean;
  onSubmit: (a: Attempt) => void;
  onExit: () => void;
}

type ModalKind = null | 'pause' | 'submit' | 'section';

export default function Exam({ test, resume, onSubmit, onExit }: Props) {
  const edu = test.pattern === 'Eduquity';
  const candidate = useMemo(() => getName(), []);

  const flat = useMemo(
    () =>
      test.sections.flatMap((s, si) => s.questions.map((q, qi) => ({ q, si, qi }))),
    [test],
  );
  const secStart = useMemo(() => {
    let c = 0;
    return test.sections.map((s) => { const st = c; c += s.questions.length; return st; });
  }, [test]);
  const total = flat.length;

  const [init] = useState(() => {
    const saved = resume ? loadProgress(test.id) : null;
    const base: QMap = {};
    flat.forEach((f) => { base[f.q.id] = { status: 'not_visited', sel: null, time: 0 }; });
    let timers = initialTimers(test);
    let cur = 0;
    if (saved) {
      Object.keys(saved.qs).forEach((k) => { if (base[k]) base[k] = saved.qs[k]; });
      if (saved.timers?.length === timers.length) timers = saved.timers;
      if (saved.cur >= 0 && saved.cur < total) cur = saved.cur;
    }
    const id = flat[cur].q.id;
    if (base[id].status === 'not_visited') base[id] = { ...base[id], status: 'not_answered' };
    return { qs: base, timers, cur };
  });

  const [qs, setQs] = useState<QMap>(init.qs);
  const [cur, setCur] = useState(init.cur);
  const [timers, setTimers] = useState<number[]>(init.timers);
  const [modal, setModal] = useState<ModalKind>(null);
  const [drawer, setDrawer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const areaRef = useRef<HTMLDivElement>(null);
  const sectionTabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const done = useRef(false);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);
  const live = useRef({ qs, cur, timers });
  live.current = { qs, cur, timers };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const act = useRef<any>({});

  const paused = modal === 'pause';
  const f = flat[cur];
  const q = f.q;
  const sec = f.si;
  const st = qs[q.id];
  const tIdx = edu ? sec : 0;
  const timeLeft = timers[tIdx];
  const lo = edu ? secStart[sec] : 0;
  const hi = edu ? secStart[sec] + test.sections[sec].questions.length - 1 : total - 1;
  const marked = st.status === 'review' || st.status === 'ans_review';

  const toast = (m: string) => {
    setToastMsg(m);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2200);
  };

  const save = () => {
    if (done.current) return;
    const l = live.current;
    saveProgress(test.id, { qs: l.qs, timers: l.timers, cur: l.cur, ts: Date.now() });
  };

  const goTo = (i: number) => {
    if (i < 0 || i >= total) return;
    const id = flat[i].q.id;
    setCur(i);
    setQs((p) => (p[id].status === 'not_visited' ? { ...p, [id]: { ...p[id], status: 'not_answered' } } : p));
    setDrawer(false);
    areaRef.current?.scrollTo({ top: 0 });
  };

  const patch = (fn: (s: QMap[string]) => QMap[string]) =>
    setQs((p) => ({ ...p, [q.id]: fn(p[q.id]) }));

  const select = (i: number) =>
    patch((s) => {
      // clicking the selected option again deselects it
      if (s.sel === i) {
        return { ...s, sel: null, status: s.status === 'review' || s.status === 'ans_review' ? 'review' : 'not_answered' };
      }
      // answering automatically removes the review mark
      return { ...s, sel: i, status: 'answered' };
    });

  const clear = () =>
    patch((s) => ({
      ...s,
      sel: null,
      status: s.status === 'review' || s.status === 'ans_review' ? 'review' : 'not_answered',
    }));

  const mark = () => {
    if (marked) {
      patch((s) => ({ ...s, status: s.sel !== null ? 'answered' : 'not_answered' }));
      return;
    }
    // marking clears any selected answer, then moves on
    patch((s) => ({ ...s, sel: null, status: 'review' }));
    if (cur < hi) goTo(cur + 1);
    else openEndPrompt();
  };

  /** end of section (Eduquity, more sections ahead) -> Submit Section; end of test -> Submit Test */
  const openEndPrompt = () => {
    setDrawer(false);
    setModal(edu && sec < test.sections.length - 1 ? 'section' : 'submit');
  };

  const next = (fromSave: boolean) => {
    if (cur < hi) goTo(cur + 1);
    else if (fromSave) openEndPrompt();
  };
  const prev = () => { if (cur > lo) goTo(cur - 1); };

  const doSubmit = () => {
    if (done.current) return;
    done.current = true;
    setFinished(true);
    setModal(null);
    const attempt = computeAttempt(test, live.current.qs);
    clearProgressEverywhere(test.id);
    onSubmit(attempt);
  };

  const advanceSection = (auto: boolean) => {
    const s = flat[live.current.cur].si;
    if (s >= test.sections.length - 1) { doSubmit(); return; }
    setModal(null);
    goTo(secStart[s + 1]);
    toast(auto ? `Time up! Moved to “${test.sections[s + 1].name}”` : `Section submitted. Now in “${test.sections[s + 1].name}”`);
  };

  const openPause = () => { save(); pushProgress(test.id); setModal('pause'); setDrawer(false); };

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => toast('Fullscreen is not available here'));
  };

  const expire = (ti: number) => {
    if (!edu || ti >= test.sections.length - 1) doSubmit();
    else advanceSection(true);
  };

  act.current = {
    modal, select, clear, mark, next, prev, toggleFs, openPause, expire, cur, lo, hi,
    optCount: q.options.length,
    closeModal: () => setModal(null),
  };

  /* Timer tick */
  useEffect(() => {
    if (paused || finished) return;
    const id = window.setInterval(() => {
      const { cur: c, timers: tm } = live.current;
      const fl = flat[c];
      const ti = edu ? fl.si : 0;
      const qid = fl.q.id;
      setQs((p) => ({ ...p, [qid]: { ...p[qid], time: p[qid].time + 1 } }));
      setTimers((p) => { const n = [...p]; n[ti] = Math.max(0, n[ti] - 1); return n; });
      if (tm[ti] - 1 <= 0) act.current.expire(ti);
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, finished, edu, flat]);

  /* Auto-save every 2 seconds */
  useEffect(() => {
    const id = window.setInterval(save, 2000);
    const onHide = () => save();
    window.addEventListener('pagehide', onHide);
    return () => { window.clearInterval(id); window.removeEventListener('pagehide', onHide); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Back button => pause modal; guard against accidental reload */
  useEffect(() => {
    const onPop = () => { history.pushState({ exam: 1 }, ''); act.current.openPause(); };
    const onUnload = (e: BeforeUnloadEvent) => { if (!done.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('popstate', onPop);
    window.addEventListener('beforeunload', onUnload);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onUnload); };
  }, []);

  /* Fullscreen state */
  useEffect(() => {
    const h = () => setIsFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', h);
    return () => {
      document.removeEventListener('fullscreenchange', h);
      if (document.fullscreenElement) document.exitFullscreen?.();
    };
  }, []);

  /* Keyboard shortcuts */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && ['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName)) return;
      const a = act.current;
      if (a.modal) {
        if (e.key === 'Escape' && a.modal !== 'pause') a.closeModal();
        return;
      }
      const k = e.key.toLowerCase();
      if (k === 'arrowright') { e.preventDefault(); a.next(false); }
      else if (k === 'arrowleft') { e.preventDefault(); a.prev(); }
      else if (k === 's') a.next(true);
      else if (k === 'm') a.mark();
      else if (k === 'r') a.clear();
      else if (k === 'f') a.toggleFs();
      else if (k === 'p') a.openPause();
      else if (k.length === 1 && k >= 'a' && k <= 'e') {
        const i = k.charCodeAt(0) - 97;
        if (i < a.optCount) a.select(i);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* Auto-scroll the active section tab into view */
  useEffect(() => {
    const el = sectionTabRefs.current[sec];
    if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [sec]);

  /* Swipe navigation */
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const s = touch.current;
    touch.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 50 && Math.abs(dx) > Math.abs(dy) * 2) {
      if (dx < 0) next(false); else prev();
    }
  };

  /* Derived summaries */
  const summarize = useCallback(
    (from: number, to: number) => {
      let answered = 0, notAnswered = 0, markedN = 0, notVisited = 0;
      for (let i = from; i <= to; i++) {
        const s = qs[flat[i].q.id];
        if (s.status === 'not_visited') notVisited++;
        else if (s.sel !== null) answered++;
        else notAnswered++;
        if (s.status === 'review' || s.status === 'ans_review') markedN++;
      }
      return { answered, notAnswered, marked: markedN, notVisited, count: to - from + 1 };
    },
    [qs, flat],
  );
  const all = summarize(0, total - 1);
  const secSum = summarize(lo, hi);

  const timerCls =
    timeLeft < 60
      ? 'bg-rose-600 text-white animate-timer'
      : timeLeft < 300
        ? 'bg-orange-500 text-white'
        : 'bg-white/10 text-white';

  return (
    <div className="h-[100dvh] flex flex-col bg-slate-100 dark:bg-slate-900 overflow-hidden select-none sm:select-auto">
      {/* Header */}
      <header className="bg-slate-900 text-white shrink-0 pt-safe border-b border-white/10">
        <div className="h-14 px-2 sm:px-4 flex items-center gap-1.5 sm:gap-3">
          <button
            onClick={openPause}
            className="touch-target px-3 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center gap-2 text-sm font-semibold transition active:scale-95"
            aria-label="Pause test"
          >
            <I n="pause" /> <span className="hidden sm:inline">Pause</span>
          </button>
          <div className="flex-1 min-w-0 px-1">
            <h1 className="font-bold text-sm sm:text-base truncate leading-tight">{test.title}</h1>
            <div className="hidden sm:block mt-0.5"><PatternBadge pattern={test.pattern} className="!py-0.5" /></div>
          </div>
          <div className={`flex items-center gap-2 px-3 h-10 rounded-xl font-mono font-bold text-base sm:text-lg tabular-nums transition-colors ${timerCls}`} title={edu ? 'Section time left' : 'Time left'}>
            <I n={timeLeft < 60 ? 'hourglass-end' : 'clock'} className="text-xs" />
            {fmtTime(timeLeft)}
          </div>
          <button
            onClick={toggleFs}
            className="hidden sm:grid touch-target place-items-center rounded-xl hover:bg-white/10"
            aria-label="Toggle fullscreen"
            title="Fullscreen (F)"
          >
            <I n={isFs ? 'compress' : 'expand'} />
          </button>
          <button
            onClick={() => setDrawer(true)}
            className="lg:hidden touch-target grid place-items-center rounded-xl bg-white/10 hover:bg-white/20"
            aria-label="Open question palette"
          >
            <I n="table-cells-large" />
          </button>
        </div>
      </header>

      {/* Section bar */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 shrink-0">
        <div className="flex items-center">
          <div className="flex-1 flex overflow-x-auto no-scrollbar px-2 sm:px-4 gap-1">
            {test.sections.map((s, i) => {
              const active = i === sec;
              const locked = edu && !active;
              const sum = summarize(secStart[i], secStart[i] + s.questions.length - 1);
              return (
                <button
                  key={s.name + i}
                  ref={(el) => { sectionTabRefs.current[i] = el; }}
                  onClick={() => {
                    if (locked) { toast(i < sec ? 'This section is already submitted' : 'Section locked until the current section ends'); return; }
                    if (!active) goTo(secStart[i]);
                  }}
                  className={`relative shrink-0 min-h-[46px] px-3.5 sm:px-5 flex items-center gap-2 text-sm font-semibold whitespace-nowrap transition ${
                    active ? 'text-indigo-600 dark:text-indigo-300' : locked ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300 hover:text-indigo-600'
                  }`}
                >
                  {locked && <I n="lock" className="text-[11px]" />}
                  {s.name}
                  <span className={`text-[11px] px-1.5 py-0.5 rounded-md font-bold ${active ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200' : 'bg-slate-100 dark:bg-slate-700'}`}>
                    {sum.answered}/{s.questions.length}
                  </span>
                  {active && <span className="absolute left-2 right-2 bottom-0 h-[3px] rounded-t-full grad-primary" />}
                </button>
              );
            })}
          </div>
          <div className="hidden md:flex items-center gap-2 pr-4 text-xs font-semibold text-slate-500 dark:text-slate-400">
            <I n="list-check" className="text-emerald-500" /> {all.answered}/{total} answered
          </div>
        </div>
        <div className="h-1 bg-slate-100 dark:bg-slate-700">
          <div className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all duration-500" style={{ width: `${(all.answered / total) * 100}%` }} />
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0 flex relative">
        <div className="flex-1 min-w-0 flex flex-col">
          <div
            ref={areaRef}
            onTouchStart={onTouchStart}
            onTouchEnd={onTouchEnd}
            className="flex-1 overflow-y-auto thin-scroll overscroll-contain"
          >
            <div key={q.id} className="max-w-4xl mx-auto p-3 sm:p-6 space-y-4 animate-fade-up">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="grad-primary text-white text-sm font-extrabold px-3.5 py-1.5 rounded-xl shadow-md shadow-indigo-500/20 whitespace-nowrap shrink-0">Q {f.qi + 1}</span>
                  <span className="flex-1 min-w-0 overflow-hidden text-ellipsis whitespace-nowrap truncate text-xs font-medium text-slate-500 dark:text-slate-400">{test.sections[sec].name} · {f.qi + 1}/{test.sections[sec].questions.length}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-bold shrink-0">
                  <span className="px-2 py-1 rounded-md bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 whitespace-nowrap shrink-0">+{test.pos}</span>
                  <span className="px-2 py-1 rounded-md bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300 whitespace-nowrap shrink-0">−{test.neg}</span>
                  {marked && <span className="shrink-0 px-2 py-1 rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300"><I n="bookmark" /></span>}
                </div>
              </div>

              <div className={`rounded-2xl bg-indigo-50/70 dark:bg-slate-800/80 ${paused ? 'blur-md select-none pointer-events-none' : ''} border border-indigo-100 dark:border-slate-700 p-4 sm:p-6 card-shadow`}>
                <RichText text={q.text} className="text-[15px] sm:text-[17px] leading-relaxed font-medium text-slate-800 dark:text-slate-100" />
                {q.img && <div className="mt-4"><ZoomImg src={q.img} /></div>}
              </div>

              <div className={`space-y-3 pb-4 ${paused ? 'blur-md select-none pointer-events-none' : ''}`} role="radiogroup">
                {q.options.map((o, i) => {
                  const on = st.sel === i;
                  return (
                    <div
                      key={i}
                      role="radio"
                      aria-checked={on}
                      tabIndex={0}
                      onClick={() => select(i)}
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(i); } }}
                      className={`flex items-center gap-3 sm:gap-4 rounded-2xl border-2 p-3 sm:p-4 min-h-[58px] cursor-pointer transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 ${
                        on
                          ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/15 scale-[1.015] shadow-lg shadow-indigo-500/15'
                          : 'border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-500/60'
                      }`}
                    >
                      <span className={`grid place-items-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl text-base font-extrabold shrink-0 transition ${on ? 'grad-primary text-white shadow-md' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                        {LETTERS[i]}
                      </span>
                      <span className="flex-1 min-w-0 space-y-2">
                        {o.text && <RichText text={o.text} className="text-[15px] sm:text-base" />}
                        {o.img && <ZoomImg src={o.img} />}
                      </span>
                      {on && <I n="circle-check" className="text-indigo-500 text-lg" />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer action bar */}
          <div className="shrink-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 pb-safe pt-2.5 px-2 sm:px-4">
            <div className="max-w-4xl mx-auto grid grid-cols-[1fr_auto_1.4fr] sm:flex sm:items-center gap-1.5 sm:gap-3">
              <button
                onClick={mark}
                className={`touch-target px-2 sm:px-5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-white transition active:scale-95 ${marked ? 'bg-violet-800 ring-2 ring-violet-300' : 'bg-violet-600 hover:bg-violet-700'}`}
              >
                <I n="bookmark" />
                <span className="hidden sm:inline">{marked ? 'Unmark Review' : 'Mark for Review'}</span>
                <span className="sm:hidden">{marked ? 'Unmark' : 'Mark'}</span>
              </button>
              <div className="hidden sm:block flex-1" />
              <button
                onClick={prev}
                disabled={cur <= lo}
                className="touch-target px-3 sm:px-5 rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition active:scale-95"
                aria-label="Previous question"
              >
                <I n="chevron-left" /> <span className="hidden sm:inline">Previous</span>
              </button>
              <button
                onClick={() => next(true)}
                className="touch-target px-3 sm:px-7 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 text-white grad-primary shadow-lg shadow-indigo-500/25 hover:brightness-110 transition active:scale-95"
              >
                Save &amp; Next <I n="chevron-right" />
              </button>
            </div>
          </div>
        </div>

        {/* Drawer overlay */}
        {drawer && <div className="lg:hidden fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-sm animate-fade" onClick={() => setDrawer(false)} />}

        {/* Sidebar */}
        <aside
          className={`fixed lg:static z-50 lg:z-auto inset-y-0 right-0 w-[88%] max-w-sm lg:w-80 lg:max-w-none flex flex-col bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 transition-transform duration-300 ${
            drawer ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="lg:hidden flex items-center justify-between px-4 h-14 bg-slate-900 text-white shrink-0 pt-safe">
            <span className="font-bold text-sm">Question Palette</span>
            <button onClick={() => setDrawer(false)} className="touch-target grid place-items-center rounded-xl hover:bg-white/10" aria-label="Close palette">
              <I n="xmark" className="text-lg" />
            </button>
          </div>

          <div className="p-4 flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 shrink-0">
            <div className="w-12 h-12 rounded-2xl grad-primary text-white grid place-items-center text-lg shadow-md"><I n="user-graduate" /></div>
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{candidate}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{test.pattern} pattern · {total} questions</div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto thin-scroll p-4 space-y-4">
            <div className="grid grid-cols-2 gap-2 text-[11px] font-semibold">
              {([
                ['answered', 'Answered', all.answered],
                ['not_answered', 'Not Answered', all.notAnswered],
                ['not_visited', 'Not Visited', all.notVisited],
                ['review', 'Marked', all.marked],
              ] as const).map(([s, l, n]) => (
                <div key={l} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  <StatusChip status={s} size="sm">{n}</StatusChip> {l}
                </div>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{test.sections[sec].name}</h3>
                {edu && <span className="text-[11px] font-bold text-amber-600 dark:text-amber-300"><I n="lock" className="mr-1" />Sectional</span>}
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {test.sections[sec].questions.map((qq, i) => {
                  const gi = secStart[sec] + i;
                  return (
                    <button
                      key={qq.id}
                      onClick={() => goTo(gi)}
                      className="grid place-items-center min-h-[44px] active:scale-90 transition"
                      aria-label={`Question ${i + 1}: ${STATUS_META[qs[qq.id].status].label}`}
                    >
                      <StatusChip status={qs[qq.id].status} current={gi === cur}>{i + 1}</StatusChip>
                    </button>
                  );
                })}
              </div>
              {!edu && test.sections.length > 1 && (
                <p className="mt-3 text-[11px] text-slate-400">Use the section tabs above to see other sections.</p>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-2 shrink-0 pb-safe">
            {edu && sec < test.sections.length - 1 && (
              <button
                onClick={() => { setModal('section'); setDrawer(false); }}
                className="w-full touch-target rounded-xl font-bold text-sm text-white bg-amber-500 hover:bg-amber-600 transition active:scale-95"
              >
                <I n="forward-step" className="mr-2" />Submit Section
              </button>
            )}
            <button
              onClick={() => { setModal('submit'); setDrawer(false); }}
              className="w-full touch-target rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-600/20 transition active:scale-95"
            >
              <I n="paper-plane" className="mr-2" />Submit Test
            </button>
          </div>
        </aside>
      </div>

      <Toast msg={toastMsg} />

      {/* Pause modal */}
      {modal === 'pause' && (
        <Modal size="md" z={70} heavyBlur>
          <div className="p-6 sm:p-7 pb-safe">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-orange-100 dark:bg-orange-500/15 text-orange-500 grid place-items-center text-2xl"><I n="pause" /></div>
            <h2 className="mt-4 text-center text-xl font-extrabold">Test Paused</h2>
            <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">{isSignedIn() ? 'The timer has stopped and your progress is synced to your account across all devices.' : 'The timer has stopped and your progress is saved on this device.'}</p>
            <div className="mt-5 grid grid-cols-4 gap-2 text-center">
              <Stat label="Answered" value={all.answered} cls="text-emerald-600 dark:text-emerald-400" />
              <Stat label="Not Ans." value={all.notAnswered} cls="text-rose-600 dark:text-rose-400" />
              <Stat label="Marked" value={all.marked} cls="text-violet-600 dark:text-violet-400" />
              <Stat label="Unseen" value={all.notVisited} cls="text-slate-600 dark:text-slate-300" />
            </div>
            <div className="mt-3 rounded-xl bg-slate-100 dark:bg-slate-900/50 py-2.5 text-center text-sm font-semibold">
              <I n="clock" className="mr-2 text-indigo-500" />{edu ? 'Section time left' : 'Time left'}: <span className="font-mono">{fmtTime(timeLeft)}</span>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <button onClick={() => { save(); pushProgress(test.id); onExit(); }} className="touch-target rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition">
                <I n="floppy-disk" className="mr-2" />Save &amp; Exit
              </button>
              <button onClick={() => setModal(null)} className="touch-target rounded-xl font-bold text-sm text-white grad-primary shadow-lg shadow-indigo-500/25 hover:brightness-110 transition">
                <I n="play" className="mr-2" />Resume
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Submit Section / Submit Test confirmation */}
      {(modal === 'submit' || modal === 'section') && (
        <Modal size="md" z={70} heavyBlur onClose={() => setModal(null)}>
          {(() => {
            const isSec = modal === 'section';
            const s = isSec ? secSum : all;
            return (
              <div className="flex-1 overflow-y-auto thin-scroll p-6 sm:p-7 pb-safe">
                <div className={`mx-auto w-16 h-16 rounded-2xl grid place-items-center text-2xl ${isSec ? 'bg-amber-100 dark:bg-amber-500/15 text-amber-500' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600'}`}>
                  <I n={isSec ? 'forward-step' : 'paper-plane'} />
                </div>
                <h2 className="mt-4 text-center text-xl font-extrabold">{isSec ? 'Submit Section?' : 'Submit Test?'}</h2>
                <p className="mt-1 text-center text-sm text-slate-500 dark:text-slate-400">
                  {isSec ? (
                    <>Section: <b className="text-slate-700 dark:text-slate-200">{test.sections[sec].name}</b></>
                  ) : (
                    'Please verify your attempt summary before final submission'
                  )}
                </p>
                <div className="mt-5 grid grid-cols-4 gap-2 text-center">
                  <Stat label="Answered" value={s.answered} cls="text-emerald-600 dark:text-emerald-400" />
                  <Stat label="Not Ans." value={s.notAnswered} cls="text-rose-600 dark:text-rose-400" />
                  <Stat label="Marked" value={s.marked} cls="text-violet-600 dark:text-violet-400" />
                  <Stat label="Unseen" value={s.notVisited} cls="text-slate-600 dark:text-slate-300" />
                </div>
                <div className="mt-3 rounded-xl bg-slate-100 dark:bg-slate-900/50 py-2.5 text-center text-sm font-semibold">
                  <I n="clock" className="mr-2 text-indigo-500" />{isSec || edu ? 'Section time left' : 'Time left'}: <span className="font-mono">{fmtTime(timeLeft)}</span>
                </div>
                {isSec && (
                  <p className="mt-3 text-center text-xs font-medium text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/25 rounded-xl px-3 py-2">
                    <I n="circle-info" className="mr-1.5" />You still have time left in this section. Submitting will move you to the next section.
                  </p>
                )}
                {!isSec && test.sections.length > 1 && (
                  <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden">
                    {test.sections.map((sc, i) => {
                      const ss = summarize(secStart[i], secStart[i] + sc.questions.length - 1);
                      return (
                        <div key={sc.name + i} className="flex items-center gap-2 px-3 py-2 text-xs">
                          <span className="flex-1 min-w-0 truncate font-semibold">{sc.name}</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{ss.answered} ans</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 whitespace-nowrap">{ss.notAnswered} not</span>
                          <span className="font-bold text-violet-600 dark:text-violet-400 whitespace-nowrap">{ss.marked} mk</span>
                          <span className="font-bold text-slate-500 whitespace-nowrap">{ss.notVisited} un</span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="mt-6 grid grid-cols-2 gap-3">
                  <button onClick={() => setModal(null)} className="touch-target rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition">
                    {isSec ? 'Cancel / Review' : 'Back to Test'}
                  </button>
                  <button
                    onClick={() => (isSec ? advanceSection(false) : doSubmit())}
                    className={`touch-target rounded-xl font-bold text-sm text-white shadow-lg transition hover:brightness-110 ${isSec ? 'bg-amber-500 shadow-amber-500/25' : 'bg-emerald-600 shadow-emerald-600/25'}`}
                  >
                    {isSec ? <>Submit Section <I n="chevron-right" className="ml-1 text-xs" /></> : 'Submit Test'}
                  </button>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
}

function Stat({ label, value, cls }: { label: string; value: number; cls: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 py-3 px-2 text-center flex flex-col items-center justify-center min-h-[72px]">
      <div className={`text-xl font-extrabold ${cls}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">{label}</div>
    </div>
  );
}
