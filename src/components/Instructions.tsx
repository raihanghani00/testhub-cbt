import { useState } from 'react';
import type { Status, Test } from '../types';
import { I, PatternBadge } from './ui';
import { StatusChip, STATUS_META } from './status';
import { fmtDuration, maxMarks, sectionSeconds, totalMinutes, totalQuestions, isSectionLocked } from '../lib/utils';
import { getName, loadProgress, setName } from '../lib/storage';

interface Props {
  test: Test;
  onBack: () => void;
  onBegin: () => void;
  onResume: () => void;
}

export default function Instructions({ test, onBack, onBegin, onResume }: Props) {
  const [agree, setAgree] = useState(false);
  const [name, setN] = useState(getName());
  const prog = loadProgress(test.id);
  const answered = prog ? Object.values(prog.qs).filter((s) => s.sel !== null).length : 0;
  const secT = sectionSeconds(test);
  const edu = isSectionLocked(test);

  const stats = [
    ['Total Questions', totalQuestions(test), 'circle-question', 'text-indigo-600 bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300'],
    ['Maximum Marks', maxMarks(test), 'award', 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300'],
    ['Duration', `${totalMinutes(test)} min`, 'clock', 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300'],
  ] as const;

  const legend: Status[] = ['not_visited', 'not_answered', 'answered', 'review', 'ans_review'];
  const keys: [string, string][] = [
    ['A B C D', 'Select option'],
    ['S', 'Save & Next'],
    ['M', 'Mark for review'],
    ['R', 'Clear response'],
    ['← →', 'Previous / Next'],
    ['F', 'Toggle fullscreen'],
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 dark:bg-slate-900">
      <header className="bg-slate-900 text-white sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={onBack} aria-label="Back" className="touch-target grid place-items-center rounded-xl hover:bg-white/10 -ml-2">
            <I n="arrow-left" />
          </button>
          <h1 className="font-bold text-base sm:text-lg truncate flex-1">{test.title}</h1>
          <PatternBadge pattern={test.pattern} />
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 space-y-5 animate-fade-up">
        {prog && (
          <div className="rounded-2xl border border-orange-200 dark:border-orange-500/30 bg-orange-50 dark:bg-orange-500/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="grid place-items-center w-11 h-11 rounded-xl bg-orange-500 text-white shrink-0"><I n="pause" /></div>
            <div className="flex-1 text-sm">
              <div className="font-bold text-orange-800 dark:text-orange-300">A paused attempt was found</div>
              <div className="text-orange-700/80 dark:text-orange-200/70">
                {answered} question{answered !== 1 ? 's' : ''} answered. Resume where you left off, or begin again (this discards the saved progress).
              </div>
            </div>
            <button onClick={onResume} className="touch-target px-5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold active:scale-95 transition">
              <I n="play" className="mr-2 text-xs" />Resume
            </button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          {stats.map(([l, v, ic, c]) => (
            <div key={l} className="rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 card-shadow p-3 sm:p-4 text-center">
              <div className={`mx-auto w-9 h-9 rounded-xl grid place-items-center text-sm ${c}`}><I n={ic} /></div>
              <div className="mt-2 text-lg sm:text-2xl font-extrabold">{v}</div>
              <div className="text-[10px] sm:text-xs uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">{l}</div>
            </div>
          ))}
        </div>

        <Card title="Sections" icon="table-list">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-semibold">#</th>
                  <th className="py-2 pr-3 font-semibold">Section</th>
                  <th className="py-2 pr-3 font-semibold text-right">Questions</th>
                  <th className="py-2 pr-3 font-semibold text-right">Marks</th>
                  <th className="py-2 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {test.sections.map((s, i) => (
                  <tr key={s.name + i} className="border-t border-slate-100 dark:border-slate-700/60">
                    <td className="py-3 pr-3 text-slate-400 font-semibold">{i + 1}</td>
                    <td className="py-3 pr-3 font-semibold">{s.name}</td>
                    <td className="py-3 pr-3 text-right">{s.questions.length}</td>
                    <td className="py-3 pr-3 text-right">{Math.round(s.questions.length * test.pos * 100) / 100}</td>
                    <td className="py-3 text-right">{edu ? fmtDuration(secT[i]) : <span className="text-slate-400">Common</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            <I n="circle-info" className="mr-1.5" />
            Correct answer: <b className="text-emerald-600">+{test.pos}</b> · Wrong answer: <b className="text-rose-600">−{test.neg}</b> · Unanswered: <b>0</b>.
            {edu ? ' Each section has its own timer; once a section ends you cannot return to it.' : ' One timer runs for the whole test; you may move freely between sections.'}
          </p>
        </Card>

        <div className="grid md:grid-cols-2 gap-5">
          <Card title="Question palette legend" icon="palette">
            <ul className="space-y-3">
              {legend.map((s, i) => (
                <li key={s} className="flex items-center gap-3 text-sm">
                  <StatusChip status={s} size="sm">{i + 1}</StatusChip>
                  <span>{STATUS_META[s].label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Questions marked for review (with or without an answer) are still evaluated if answered.
            </p>
          </Card>
          <Card title="Keyboard shortcuts" icon="keyboard">
            <ul className="space-y-2.5">
              {keys.map(([k, d]) => (
                <li key={k} className="flex items-center justify-between text-sm">
                  <span className="text-slate-600 dark:text-slate-300">{d}</span>
                  <kbd className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-xs font-bold font-mono">{k}</kbd>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">On touch devices, swipe left / right to change question.</p>
          </Card>
        </div>

        <Card title="Candidate" icon="user">
          <input
            value={name}
            onChange={(e) => { setN(e.target.value); setName(e.target.value); }}
            placeholder="Your name"
            maxLength={40}
            className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500"
          />
        </Card>
      </main>

      <footer className="sticky bottom-0 z-20 glass border-t pb-safe pt-3">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <label className="flex items-start gap-3 flex-1 cursor-pointer select-none min-h-[44px] items-center">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="w-5 h-5 accent-indigo-600 shrink-0" />
            <span className="text-sm text-slate-600 dark:text-slate-300">I have read and understood the instructions and I am ready to begin.</span>
          </label>
          <button
            disabled={!agree}
            onClick={onBegin}
            className="touch-target px-8 rounded-xl grad-primary text-white font-bold text-sm shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:shadow-none hover:brightness-110 active:scale-95 transition"
          >
            Begin Test <I n="arrow-right" className="ml-2 text-xs" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function Card({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 card-shadow p-4 sm:p-5">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-3">
        <I n={icon} className="text-indigo-500" /> {title}
      </h2>
      {children}
    </section>
  );
}
