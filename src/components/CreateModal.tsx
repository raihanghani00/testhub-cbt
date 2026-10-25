import { useMemo, useRef, useState } from 'react';
import type { Pattern, Test } from '../types';
import { I, Modal } from './ui';
import { buildTest, parseAny } from '../lib/parser';
import { SAMPLE_TXT } from '../lib/sample';

interface Props {
  onClose: () => void;
  onCreate: (t: Test) => void;
  jsonOnly?: boolean;
}

const field = 'w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-3.5 h-11 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition disabled:opacity-40';

export default function CreateModal({ onClose, onCreate, jsonOnly }: Props) {
  const [title, setTitle] = useState('');
  const [patternKey, setPatternKey] = useState<'TCS' | 'Eduquity' | 'Custom'>('TCS');
  const [customPattern, setCustomPattern] = useState('');
  const [duration, setDuration] = useState('60');
  const [secDur, setSecDur] = useState('20');
  const [pos, setPos] = useState('2');
  const [neg, setNeg] = useState('0.5');
  const [titleAuto, setTitleAuto] = useState(false);
  const [raw, setRaw] = useState('');
  const [guide, setGuide] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const parsed = useMemo(() => (raw.trim() ? parseAny(raw) : null), [raw]);
  const total = parsed?.sections.reduce((a, s) => a + s.questions.length, 0) ?? 0;

  const num = (v: string, d: number) => { const n = parseFloat(v); return Number.isFinite(n) && n >= 0 ? n : d; };
  const finalTitle = title.trim() || parsed?.title || '';
  const sectionLocked = patternKey === 'Eduquity' || (patternKey === 'Custom' && num(secDur, 0) > 0);
  const resolvedPattern: Pattern = patternKey === 'Custom'
    ? (customPattern.trim() || 'Custom')
    : patternKey;

  const [jsonError, setJsonError] = useState('');

  const isJsonText = (t: string) => /^\s*[{[]/.test(t) && !/^\s*\[\s*(SECTION|TITLE)/i.test(t);

  /** JSON files come from a teacher with fixed timing & marks: import directly, no editing. */
  const importJson = (text: string, fallbackTitle: string): boolean => {
    const p = parseAny(text);
    const count = p.sections.reduce((a, s) => a + s.questions.length, 0);
    if (!count) {
      setJsonError(p.errors[0] || 'This JSON file has no valid questions.');
      return false;
    }
    const s = p.settings ?? {};
    const pat: Pattern = s.pattern ?? 'TCS';
    onCreate(
      buildTest(
        {
          title: p.title || fallbackTitle || 'Imported Test',
          pattern: pat,
          duration: s.duration && s.duration > 0 ? s.duration : 60,
          sectionDuration: pat === 'Eduquity' ? (s.sectionDuration && s.sectionDuration > 0 ? s.sectionDuration : 20) : 0,
          pos: s.pos ?? 2,
          neg: s.neg ?? 0.5,
        },
        p.sections,
      ),
    );
    return true;
  };

  const onFile = (f?: File) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      const text = String(r.result || '');
      setJsonError('');
      if (isJsonText(text) || /\.json$/i.test(f.name)) {
        importJson(text, f.name.replace(/\.json$/i, ''));
        return;
      }
      setRaw(text);
      setFileName(f.name);
      const p = parseAny(text);
      if (!title.trim()) { setTitle(p.title || f.name.replace(/\.(txt|json)$/i, '')); setTitleAuto(true); }
    };
    r.readAsText(f);
  };

  const loadSample = () => {
    setRaw(SAMPLE_TXT);
    setFileName('');
    if (!title.trim()) { setTitle('SSC Mock Test · Sample 01'); setTitleAuto(true); }
  };

  const clearAll = () => {
    setJsonError('');
    setRaw('');
    setFileName('');
    if (titleAuto) { setTitle(''); setTitleAuto(false); }
  };

  const submit = () => {
    if (!parsed || !total) return;
    const dur = Math.max(1, num(duration, 60));
    onCreate(
      buildTest(
        {
          title: finalTitle || 'Untitled Mock Test',
          pattern: resolvedPattern,
          duration: dur,
          sectionDuration: sectionLocked ? Math.max(1, num(secDur, 20)) : 0,
          pos: num(pos, 1),
          neg: num(neg, 0),
        },
        parsed.sections,
      ),
    );
  };

  return (
    <Modal size="xl" onClose={onClose}>
      <div className="flex items-center justify-between px-5 sm:px-7 py-4 border-b border-slate-200 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="grad-primary w-10 h-10 rounded-xl grid place-items-center text-white"><I n="file-circle-plus" /></div>
          <div className="leading-tight">
            <h2 className="font-extrabold text-lg">{jsonOnly ? 'Load Test File' : 'Create / Import Test'}</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{jsonOnly ? 'Upload a .json test file shared by your teacher' : 'Upload a .txt or .json file, or paste your questions'}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close" className="touch-target grid place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700">
          <I n="xmark" className="text-lg" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto thin-scroll px-5 sm:px-7 py-5 space-y-5">
        {/* Format guide */}
        {!jsonOnly && (
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/70 dark:bg-indigo-500/10 overflow-hidden">
          <button onClick={() => setGuide((g) => !g)} className="w-full flex items-center justify-between px-4 min-h-[48px] text-sm font-bold text-indigo-700 dark:text-indigo-300">
            <span><I n="book-open" className="mr-2" />TXT format guide</span>
            <I n="chevron-down" className={`transition-transform ${guide ? 'rotate-180' : ''}`} />
          </button>
          {guide && (
            <div className="px-4 pb-4 grid md:grid-cols-[1.2fr_1fr] gap-4 animate-fade">
              <pre className="text-[12px] leading-relaxed bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto thin-scroll font-mono">{`[SECTION: Quantitative Aptitude]

Q1. Solve $x^2 - 5x + 6 = 0$
Img: https://site.com/figure.png
A) 2 and 3
B) 1 and 6 | https://site.com/b.png
C) -2 and -3
D) 5 and 1
Ans: A
Exp: Factorise as $(x-2)(x-3)$.`}</pre>
              <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                {[
                  ['[SECTION: Name]', 'starts a new section'],
                  ['Q1.', 'starts a question (multi-line allowed)'],
                  ['Img: URL', 'image for the question'],
                  ['A) Text | URL', 'option, optional image after “|”'],
                  ['Ans: A', 'correct option (letter)'],
                  ['Exp: Text', 'explanation shown in solutions'],
                  ['$...$ / $$...$$', 'inline / display KaTeX math'],
                ].map(([c, d]) => (
                  <li key={c} className="flex gap-2">
                    <code className="shrink-0 px-1.5 py-0.5 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 font-mono text-[11px] text-indigo-600 dark:text-indigo-300">{c}</code>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        )}

        {/* Form */}
        {!jsonOnly && (<div className="grid sm:grid-cols-2 gap-4">
          <Label text="Test title" className="sm:col-span-2">
            <input className={field} placeholder="e.g. SSC CGL Tier-I Mock 05" value={title} onChange={(e) => { setTitle(e.target.value); setTitleAuto(false); }} />
          </Label>
          <Label text="Exam pattern" className="sm:col-span-2">
            <div className="grid grid-cols-3 gap-2">
              {([
                ['TCS', 'stopwatch'],
                ['Eduquity', 'layer-group'],
                ['Custom', 'sliders'],
              ] as const).map(([k, ic]) => (
                <button
                  key={k}
                  onClick={() => setPatternKey(k)}
                  className={`text-center rounded-xl border-2 py-2 px-3 transition ${patternKey === k ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}
                >
                  <div className="font-bold text-xs flex items-center justify-center gap-1.5"><I n={ic} className={patternKey === k ? 'text-indigo-500' : 'text-slate-400'} />{k}</div>
                </button>
              ))}
            </div>
            {patternKey === 'Custom' && (
              <input
                className={`${field} mt-2`}
                placeholder="Enter pattern name (e.g., Banking, SSC)"
                value={customPattern}
                onChange={(e) => setCustomPattern(e.target.value)}
                maxLength={24}
              />
            )}
          </Label>
          <Label text={!sectionLocked ? 'Total duration (min)' : 'Total duration (min) — fallback'}>
            <input type="number" min={1} className={field} value={duration} onChange={(e) => setDuration(e.target.value)} />
          </Label>
          <Label text="Sectional duration (min)">
            <input type="number" min={1} className={field} disabled={!sectionLocked} value={secDur} onChange={(e) => setSecDur(e.target.value)} />
          </Label>
          <Label text="Positive marks">
            <input type="number" min={0} step="0.25" className={field} value={pos} onChange={(e) => setPos(e.target.value)} />
          </Label>
          <Label text="Negative marks">
            <input type="number" min={0} step="0.25" className={field} value={neg} onChange={(e) => setNeg(e.target.value)} />
          </Label>
        </div>
        )}

        {/* Input */}
        <div>
          <div className="flex flex-row items-center gap-2 mb-2 overflow-x-auto thin-scroll">
            <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 shrink-0">Questions</span>
            <input ref={fileRef} type="file" accept={jsonOnly ? '.json,application/json' : '.txt,.json,text/plain,application/json'} className="hidden" onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
            <button onClick={() => fileRef.current?.click()} className="touch-target shrink-0 text-xs px-2 py-1.5 rounded-lg font-semibold border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
              <I n="upload" className="mr-1 text-indigo-500" />{jsonOnly ? '.json' : 'File'}
            </button>
            {!jsonOnly && (
            <button onClick={loadSample} className="touch-target shrink-0 text-xs px-2 py-1.5 rounded-lg font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300 transition">
              <I n="wand-magic-sparkles" className="mr-1" />Sample
            </button>
            )}
            {(raw || fileName) && (
              <button onClick={clearAll} className="touch-target shrink-0 text-xs px-2 py-1.5 rounded-lg font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/25 transition animate-fade">
                <I n="eraser" className="mr-1" />Clear
              </button>
            )}
          </div>
          {jsonError && (
            <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-2 animate-fade">
              <I n="circle-exclamation" className="mr-1.5" />{jsonError}
            </div>
          )}
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-2">
            <I n="circle-info" className="mr-1" />A teacher’s <b>.json</b> test file is imported instantly with its fixed timing and marks — no editing needed.
          </p>
          {fileName && <div className="text-xs text-slate-500 mb-2"><I n="paperclip" className="mr-1" />{fileName}</div>}
          {!jsonOnly && (
          <textarea
            value={raw}
            onChange={(e) => { setJsonError(''); setRaw(e.target.value); }}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text');
              if (t.trim().startsWith('{') && isJsonText(t)) {
                e.preventDefault();
                setJsonError('');
                importJson(t, title.trim());
              }
            }}
            spellCheck={false}
            placeholder={'[SECTION: General]\n\nQ1. Your question here?\nA) Option 1\nB) Option 2\nC) Option 3\nD) Option 4\nAns: B\nExp: Because...'}
            className="w-full h-48 rounded-2xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 p-4 text-[13px] font-mono leading-relaxed outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 thin-scroll resize-y"
          />
          )}
        </div>

        {/* Live preview */}
        {parsed && (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 p-4 animate-fade">
            <div className="flex items-center gap-2 text-sm font-bold">
              <I n={total ? 'circle-check' : 'circle-exclamation'} className={total ? 'text-emerald-500' : 'text-rose-500'} />
              {total ? `${total} question${total > 1 ? 's' : ''} parsed in ${parsed.sections.length} section${parsed.sections.length > 1 ? 's' : ''}` : 'No valid questions found'}
            </div>
            {total > 0 && (
              <div className="mt-3 space-y-2">
                {parsed.sections.map((s) => (
                  <div key={s.name} className="flex items-center gap-3 text-xs">
                    <span className="w-36 sm:w-48 truncate font-semibold">{s.name}</span>
                    <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div className="h-full grad-primary rounded-full" style={{ width: `${(s.questions.length / total) * 100}%` }} />
                    </div>
                    <span className="w-8 text-right font-bold">{s.questions.length}</span>
                  </div>
                ))}
              </div>
            )}
            {parsed.errors.length > 0 && (
              <details className="mt-3" open={!total}>
                <summary className="text-xs font-semibold text-amber-600 dark:text-amber-400 cursor-pointer">
                  {parsed.errors.length} issue{parsed.errors.length > 1 ? 's' : ''} (skipped)
                </summary>
                <ul className="mt-2 text-xs text-slate-600 dark:text-slate-300 space-y-1 max-h-28 overflow-y-auto thin-scroll">
                  {parsed.errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              </details>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-3 px-5 sm:px-7 py-4 border-t border-slate-200 dark:border-slate-700 pb-safe">
        <button onClick={onClose} className="touch-target px-5 rounded-xl text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-700 transition">Cancel</button>
        <button
          onClick={submit}
          disabled={!total}
          className="touch-target px-6 rounded-xl text-sm font-bold text-white grad-primary shadow-lg shadow-indigo-500/25 disabled:opacity-40 disabled:shadow-none hover:brightness-110 active:scale-95 transition"
        >
          <I n="circle-plus" className="mr-2" />{jsonOnly ? 'Load test' : 'Create test'}
        </button>
      </div>
    </Modal>
  );
}

function Label({ text, children, className = '' }: { text: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="block text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1.5">{text}</span>
      {children}
    </label>
  );
}
