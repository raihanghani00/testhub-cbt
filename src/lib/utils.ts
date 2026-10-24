import type { Attempt, QMap, Test } from '../types';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const pad = (n: number) => String(n).padStart(2, '0');

export function fmtTime(sec: number): string {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function fmtDuration(sec: number): string {
  sec = Math.max(0, Math.round(sec));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export const fmtDate = (t: number) =>
  new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const fmtClock = (t: number) =>
  new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export const round2 = (n: number) => Math.round(n * 100) / 100;

export const totalQuestions = (t: Test) => t.sections.reduce((a, s) => a + s.questions.length, 0);

export const maxMarks = (t: Test) => round2(totalQuestions(t) * t.pos);

/** seconds allotted for each section (Eduquity) */
export function sectionSeconds(t: Test): number[] {
  const per = t.sectionDuration > 0 ? t.sectionDuration : t.duration / Math.max(1, t.sections.length);
  return t.sections.map(() => Math.max(1, Math.round(per * 60)));
}

/** initial timers array: single global timer for TCS, one per section for Eduquity */
export function initialTimers(t: Test): number[] {
  return t.pattern === 'TCS' ? [Math.max(1, Math.round(t.duration * 60))] : sectionSeconds(t);
}

export function totalMinutes(t: Test): number {
  return t.pattern === 'TCS'
    ? t.duration
    : Math.round(sectionSeconds(t).reduce((a, b) => a + b, 0) / 60);
}

export function computeAttempt(test: Test, qs: QMap): Attempt {
  let score = 0, correct = 0, wrong = 0, skipped = 0, timeTaken = 0;
  const sectionStats = test.sections.map((s) => {
    let sc = 0, c = 0, w = 0, sk = 0, tm = 0;
    s.questions.forEach((q) => {
      const st = qs[q.id];
      tm += st?.time || 0;
      if (!st || st.sel === null || st.sel === undefined) sk++;
      else if (st.sel === q.ans) { c++; sc += test.pos; }
      else { w++; sc -= test.neg; }
    });
    score += sc; correct += c; wrong += w; skipped += sk; timeTaken += tm;
    return {
      name: s.name,
      score: round2(sc),
      max: round2(s.questions.length * test.pos),
      correct: c, wrong: w, skipped: sk, time: tm, total: s.questions.length,
    };
  });
  const attempted = correct + wrong;
  return {
    id: uid(),
    testId: test.id,
    title: test.title,
    pattern: test.pattern,
    date: Date.now(),
    score: round2(score),
    maxScore: maxMarks(test),
    correct, wrong, skipped,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    timeTaken,
    qs,
    test,
    sectionStats,
  };
}

export const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

export function download(name: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
