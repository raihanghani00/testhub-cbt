import { useEffect, useMemo, useState } from 'react';
import type { Attempt } from '../types';
import { I, PatternBadge, RichText, ZoomImg } from './ui';
import { LETTERS, fmtDate, fmtClock, fmtDuration } from '../lib/utils';

interface Props {
  attempt: Attempt;
  fromHistory: boolean;
  onHome: () => void;
  onMockTests: () => void;
  onRetake: () => void;
}

type Filter = 'all' | 'correct' | 'wrong' | 'skip';

export default function Result({ attempt: a, fromHistory, onHome, onMockTests, onRetake }: Props) {
  const { test } = a;
  const [filter, setFilter] = useState<Filter>('all');
  const [secFilter, setSecFilter] = useState<number>(-1);
  const [ring, setRing] = useState(0);
  const [pctRing, setPctRing] = useState(0);

  const pct = a.maxScore > 0 ? (a.score / a.maxScore) * 100 : 0;
  const percentile = Math.min(99.9, Math.max(1, Math.round(50 + (pct / 100) * 49)));

  useEffect(() => {
    window.scrollTo({ top: 0 });
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 1000);
      const ease = 1 - Math.pow(1 - p, 3);
      setRing(Math.round(a.accuracy * ease));
      setPctRing(Math.round(percentile * ease));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [a.accuracy, percentile]);

  const rows = useMemo(
    () =>
      test.sections.flatMap((s, si) =>
        s.questions.map((q, qi) => {
          const st = a.qs[q.id];
          const sel = st?.sel ?? null;
          const status: Exclude<Filter, 'all'> = sel === null ? 'skip' : sel === q.ans ? 'correct' : 'wrong';
          return { q, si, qi, sel, status, time: st?.time ?? 0, section: s.name };
        }),
      ).map((r, i) => ({ ...r, n: i + 1 })),
    [test, a.qs],
  );

  const shown = rows.filter((r) => (secFilter < 0 || r.si === secFilter) && (filter === 'all' || r.status === filter));
  const verdict =
    pct >= 85 ? ['Outstanding!', 'text-emerald-500'] : pct >= 60 ? ['Great work', 'text-emerald-500'] : pct >= 35 ? ['Good effort', 'text-amber-500'] : ['Keep practising', 'text-rose-500'];

  const pills: { k: Filter; label: string; n: number; on: string }[] = [
    { k: 'all', label: 'All', n: rows.length, on: 'grad-primary text-white' },
    { k: 'correct', label: 'Correct', n: a.correct, on: 'bg-emerald-600 text-white' },
    { k: 'wrong', label: 'Wrong', n: a.wrong, on: 'bg-rose-600 text-white' },
    { k: 'skip', label: 'Skip', n: a.skipped, on: 'bg-slate-600 text-white' },
  ];

  return (
    <div className="min-h-[100dvh] bg-slate-50 dark:bg-slate-900 dot-grid">
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-5xl mx-auto px-3 sm:px-6 h-16 flex items-center gap-2 sm:gap-3">
          <button onClick={onHome} aria-label="Back" className="touch-target grid place-items-center rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition">
            <I n="arrow-left" />
          </button>
          <div className="flex-1 min-w-0 leading-tight">
            <h1 className="font-extrabold text-sm sm:text-base truncate">{a.title}</h1>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {fromHistory ? 'History report · ' : 'Performance report · '}{fmtDate(a.date)}, {fmtClock(a.date)}
            </div>
          </div>
          <button onClick={onRetake} className="touch-target px-3 sm:px-4 rounded-xl text-sm font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 transition flex items-center gap-2">
            <I n="rotate-right" /> <span className="hidden sm:inline">Retake</span>
          </button>
          <button onClick={onMockTests} aria-label="Home" className="touch-target px-3 sm:px-4 rounded-xl text-sm font-bold text-white grad-primary shadow-md flex items-center gap-2 hover:brightness-110 transition">
            <I n="house" /> <span className="hidden sm:inline">Home</span>
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-3 sm:px-6 py-3 sm:py-8 space-y-3 sm:space-y-6">
        {/* Score hero */}
        <section className="relative rounded-2xl overflow-hidden glass card-shadow-lg p-3 sm:p-5 animate-fade-up">
          <div className="absolute -top-16 -left-12 w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute -bottom-16 -right-8 w-48 h-48 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-stretch">
            <div className="text-left flex-1 min-w-0">
              <div className="flex items-center justify-start gap-2">
                <PatternBadge pattern={a.pattern} />
                <span className={`text-xs sm:text-sm font-bold ${verdict[1]}`}>{verdict[0]}</span>
              </div>
              <div className="mt-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.18em] font-bold text-slate-500 dark:text-slate-400">Your score</div>
              <div className="mt-0 flex items-baseline justify-start gap-1.5">
                <span className="grad-text text-3xl sm:text-5xl font-black tracking-tight leading-none">{a.score}</span>
                <span className="text-base sm:text-2xl font-bold text-slate-400">/ {a.maxScore}</span>
              </div>
              <div className="mt-2.5 sm:mt-3 flex flex-wrap justify-start gap-1.5 sm:gap-2">
                <Pill icon="check" label={`${a.correct} Correct`} cls="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" />
                <Pill icon="xmark" label={`${a.wrong} Wrong`} cls="bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" />
                <Pill icon="minus" label={`${a.skipped} Skipped`} cls="bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200" />
                <Pill icon="clock" label={fmtDuration(a.timeTaken)} cls="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" />
              </div>
            </div>
            <div className="flex items-center justify-center gap-3 sm:gap-4 shrink-0">
              <RingCircle value={ring} max={100} suffix="%" label="Accuracy" color="#10b981" size="sm:w-24 sm:h-24 w-20 h-20" />
              <RingCircle value={pctRing} max={100} suffix="%" label="Percentile" color="#6366f1" size="sm:w-24 sm:h-24 w-20 h-20" />
            </div>
          </div>
        </section>

        {/* Sectional analysis */}
        <section className="glass card-shadow rounded-3xl p-4 sm:p-7 animate-fade-up" style={{ animationDelay: '100ms' }}>
          <h2 className="font-extrabold text-base sm:text-lg flex items-center gap-2"><I n="chart-simple" className="text-indigo-500" />Sectional Analysis</h2>
          <div className="mt-3 sm:mt-5 space-y-3.5 sm:space-y-5">
            {a.sectionStats.map((s, i) => {
              const w = s.max > 0 ? Math.max(0, Math.min(100, (s.score / s.max) * 100)) : 0;
              const hue = w >= 70 ? 'from-emerald-400 to-emerald-600' : w >= 40 ? 'from-amber-400 to-orange-500' : 'from-rose-400 to-rose-600';
              return (
                <div key={s.name + i}>
                  <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{s.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">{s.correct}✓</span> ·{' '}
                        <span className="text-rose-600 dark:text-rose-400 font-semibold">{s.wrong}✗</span> ·{' '}
                        <span className="font-semibold">{s.skipped}</span> skipped · <I n="clock" className="text-[10px]" /> {fmtDuration(s.time)}
                      </div>
                    </div>
                    <div className="text-right shrink-0 font-extrabold">
                      {s.score}<span className="text-sm text-slate-400 font-semibold"> / {s.max}</span>
                    </div>
                  </div>
                  <div className="mt-1.5 sm:mt-2 h-2.5 sm:h-3 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                    <div className={`h-full rounded-full bg-gradient-to-r ${hue} transition-all duration-1000`} style={{ width: `${w}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Filter bar */}
        <div className="sticky top-16 z-20 -mx-3 sm:mx-0 px-3 sm:px-4 py-3 glass sm:rounded-2xl card-shadow">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5">
            <h2 className="font-extrabold text-lg flex items-center gap-2 mr-auto"><I n="lightbulb" className="text-amber-500" />Solutions</h2>
            <select
              value={secFilter}
              onChange={(e) => setSecFilter(parseInt(e.target.value, 10))}
              className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/40 max-w-[48%] sm:max-w-none"
              aria-label="Filter by section"
            >
              <option value={-1}>All sections</option>
              {test.sections.map((s, i) => <option key={i} value={i}>{s.name}</option>)}
            </select>
            <div className="flex gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {pills.map((p) => {
                const on = filter === p.k;
                return (
                  <button
                    key={p.k}
                    onClick={() => setFilter(on && p.k !== 'all' ? 'all' : p.k)}
                    className={`touch-target shrink-0 px-3.5 rounded-xl text-sm font-bold transition active:scale-95 ${on ? p.on + ' shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'}`}
                  >
                    {p.label} <span className={`ml-1 text-xs ${on ? 'opacity-80' : 'opacity-60'}`}>{p.n}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Solutions */}
        <section className="space-y-5">
          {shown.length === 0 && (
            <div className="glass rounded-3xl py-12 text-center text-slate-500 dark:text-slate-400">
              <I n="filter-circle-xmark" className="text-3xl mb-3" />
              <div className="font-semibold">No questions match these filters</div>
            </div>
          )}
          {shown.map((r) => {
            const marks = r.status === 'correct' ? `+${test.pos}` : r.status === 'wrong' ? `−${test.neg}` : '0';
            const tone =
              r.status === 'correct'
                ? { bar: 'bg-emerald-500', icon: 'check', chip: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300' }
                : r.status === 'wrong'
                  ? { bar: 'bg-rose-500', icon: 'xmark', chip: 'text-rose-700 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300' }
                  : { bar: 'bg-slate-400', icon: 'minus', chip: 'text-slate-600 bg-slate-200 dark:bg-slate-700 dark:text-slate-200' };
            return (
              <article key={r.q.id} className="rounded-3xl bg-white dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 card-shadow overflow-hidden animate-fade-up">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 sm:px-5 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <span className={`w-8 h-8 rounded-full grid place-items-center text-white text-sm ${tone.bar}`}><I n={tone.icon} /></span>
                  <span className="font-extrabold">Q{r.n}</span>
                  <span className="text-xs font-semibold px-2 py-1 rounded-md bg-slate-200/70 dark:bg-slate-700 text-slate-600 dark:text-slate-300 max-w-[50%] truncate">{r.section}</span>
                  <span className="ml-auto flex items-center gap-2 text-xs font-bold">
                    <span className="text-slate-500 dark:text-slate-400"><I n="clock" className="mr-1" />{fmtDuration(r.time)}</span>
                    <span className={`px-2.5 py-1 rounded-lg ${tone.chip}`}>{marks} marks</span>
                  </span>
                </div>
                <div className="p-4 sm:p-6">
                  <RichText text={r.q.text} className="text-[15px] sm:text-base leading-relaxed font-medium" />
                  {r.q.img && <div className="mt-4"><ZoomImg src={r.q.img} /></div>}

                  <div className="mt-5 grid sm:grid-cols-2 gap-3">
                    {r.q.options.map((o, i) => {
                      const isAns = i === r.q.ans;
                      const isWrong = r.sel === i && !isAns;
                      return (
                        <div
                          key={i}
                          className={`flex items-center gap-3 rounded-2xl border-2 p-3 ${
                            isAns
                              ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10'
                              : isWrong
                                ? 'border-rose-500 bg-rose-50 dark:bg-rose-500/10'
                                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/40'
                          }`}
                        >
                          <span className={`grid place-items-center w-9 h-9 rounded-xl text-sm font-extrabold shrink-0 ${isAns ? 'bg-emerald-500 text-white' : isWrong ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-200'}`}>
                            {LETTERS[i]}
                          </span>
                          <span className="flex-1 min-w-0 space-y-2">
                            {o.text && <RichText text={o.text} className="text-sm" />}
                            {o.img && <ZoomImg src={o.img} />}
                          </span>
                          {isAns && <span className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300 whitespace-nowrap">{r.sel === i ? 'Your answer' : 'Correct'}</span>}
                          {isWrong && <span className="text-[10px] font-bold uppercase text-rose-700 dark:text-rose-300 whitespace-nowrap">Your answer</span>}
                        </div>
                      );
                    })}
                  </div>

                  <div className="mt-5 flex gap-3 rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/25 p-4">
                    <span className="w-9 h-9 shrink-0 rounded-xl bg-sky-500 text-white grid place-items-center"><I n="lightbulb" /></span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold uppercase tracking-wide text-sky-700 dark:text-sky-300">Solution</div>
                      <div className="mt-1 text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                {r.q.exp ? <RichText text={r.q.exp} /> : <span className="text-slate-500">No explanation provided.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      </main>
    </div>
  );
}

function Pill({ icon, label, cls }: { icon: string; label: string; cls: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${cls}`}>
      <I n={icon} className="text-xs" /> {label}
    </span>
  );
}

function RingCircle({ value, max, suffix, label, color, size }: { value: number; max: number; suffix: string; label: string; color: string; size: string }) {
  const deg = (value / max) * 360;
  return (
    <div className={`relative ${size} rounded-full grid place-items-center`} style={{ background: `conic-gradient(${color} ${deg}deg, rgba(148,163,184,0.22) 0deg)` }}>
      <div className="absolute inset-2 rounded-full bg-white dark:bg-slate-800 grid place-items-center shadow-inner">
        <div className="text-center">
          <div className="text-lg sm:text-xl font-black tabular-nums leading-none">{value}<span className="text-[10px] sm:text-xs text-slate-400 font-bold">{suffix}</span></div>
          <div className="text-[8px] sm:text-[9px] uppercase tracking-[0.1em] font-bold text-slate-500 dark:text-slate-400 mt-0.5">{label}</div>
        </div>
      </div>
    </div>
  );
}
