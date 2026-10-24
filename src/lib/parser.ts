import type { Opt, Pattern, Question, Section, Test } from '../types';
import { LETTERS, uid } from './utils';

export interface TestSettings {
  pattern?: Pattern;
  duration?: number;
  sectionDuration?: number;
  pos?: number;
  neg?: number;
}

export interface ParseResult {
  title?: string;
  settings?: TestSettings;
  sections: Section[];
  errors: string[];
}

interface RawQ {
  n: string;
  line: number;
  text: string;
  img?: string;
  options: Opt[];
  ans: string;
  exp: string;
}

const RE_SECTION = /^\[\s*SECTION\s*:\s*(.+?)\s*\]$/i;
const RE_Q = /^Q\s*(\d+)\s*[.):\-]\s*(.*)$/i;
const RE_IMG = /^Img\s*:\s*(\S.*)$/i;
const RE_OPT = /^\(?([A-Ha-h])[).]\s*(.*)$/;
const RE_ANS = /^Ans(?:wer)?\s*:\s*(.+)$/i;
const RE_EXP = /^(?:Exp(?:lanation)?|Sol(?:ution)?)\s*:\s*(.*)$/i;
const RE_OPT_IMG = /\s\|\s*((?:https?:\/\/|\/|data:)\S+)\s*$/i;
const RE_OPT_IMG_ONLY = /^\|\s*((?:https?:\/\/|\/|data:)\S+)\s*$/i;

function splitOption(raw: string): Opt {
  const t = raw.trim();
  const only = t.match(RE_OPT_IMG_ONLY);
  if (only) return { text: '', img: only[1] };
  const m = t.match(RE_OPT_IMG);
  if (m) return { text: t.slice(0, m.index).trim(), img: m[1] };
  return { text: t };
}

function resolveAns(raw: string, optCount: number): number {
  const s = raw.trim();
  const l = s.match(/^\(?([A-Ha-h])\)?(?:\b|$)/);
  if (l) {
    const i = l[1].toUpperCase().charCodeAt(0) - 65;
    return i < optCount ? i : -1;
  }
  if (/^\d+$/.test(s)) {
    const i = parseInt(s, 10) - 1;
    return i >= 0 && i < optCount ? i : -1;
  }
  return -1;
}

export function parseTxt(raw: string): ParseResult {
  const lines = raw.replace(/\r/g, '').split('\n');
  const groups: { name: string; qs: RawQ[] }[] = [];
  const errors: string[] = [];
  let group: { name: string; qs: RawQ[] } | null = null;
  let q: RawQ | null = null;
  let field: 'q' | 'opt' | 'exp' | null = null;
  let title: string | undefined;

  lines.forEach((lineRaw, idx) => {
    const line = lineRaw.trim();
    if (!line) return;
    let m: RegExpMatchArray | null;

    if ((m = line.match(/^\[\s*TITLE\s*:\s*(.+?)\s*\]$/i))) { title = m[1]; return; }

    if ((m = line.match(RE_SECTION))) {
      group = { name: m[1], qs: [] };
      groups.push(group);
      q = null; field = null;
      return;
    }

    if ((m = line.match(RE_Q))) {
      if (!group) { group = { name: 'General', qs: [] }; groups.push(group); }
      q = { n: m[1], line: idx + 1, text: m[2], options: [], ans: '', exp: '' };
      group.qs.push(q);
      field = 'q';
      return;
    }

    if (!q) return; // junk before first question

    if ((m = line.match(RE_IMG))) {
      if (q.options.length === 0) q.img = m[1].trim();
      else q.options[q.options.length - 1].img = m[1].trim();
      return;
    }
    if ((m = line.match(RE_ANS))) { q.ans = m[1]; field = null; return; }
    if ((m = line.match(RE_EXP))) { q.exp = m[1]; field = 'exp'; return; }
    if ((m = line.match(RE_OPT)) && q.ans === '' && field !== 'exp') {
      const letterIdx = m[1].toUpperCase().charCodeAt(0) - 65;
      if (letterIdx === q.options.length) {
        q.options.push(splitOption(m[2]));
        field = 'opt';
        return;
      }
    }
    // continuation lines
    if (field === 'q') q.text += '\n' + line;
    else if (field === 'exp') q.exp += '\n' + line;
    else if (field === 'opt') {
      const last = q.options[q.options.length - 1];
      const extra = splitOption(line);
      last.text = (last.text ? last.text + ' ' : '') + extra.text;
      if (extra.img) last.img = extra.img;
    }
  });

  const sections: Section[] = [];
  groups.forEach((g) => {
    const questions: Question[] = [];
    g.qs.forEach((r) => {
      const label = `Q${r.n} (line ${r.line})`;
      if (!r.text.trim() && !r.img) { errors.push(`${label}: missing question text`); return; }
      if (r.options.length < 2) { errors.push(`${label}: needs at least 2 options`); return; }
      const ans = resolveAns(r.ans, r.options.length);
      if (ans < 0) { errors.push(`${label}: missing or invalid "Ans:" (use ${LETTERS.slice(0, r.options.length).join('/')})`); return; }
      questions.push({
        id: '', text: r.text.trim(), img: r.img, options: r.options, ans,
        exp: r.exp.trim() || undefined,
      });
    });
    if (questions.length) sections.push({ name: g.name, questions });
  });
  return { title, sections: assignIds(sections), errors };
}

function assignIds(sections: Section[]): Section[] {
  return sections.map((s, si) => ({
    ...s,
    questions: s.questions.map((q, qi) => ({ ...q, id: `s${si}q${qi}` })),
  }));
}

/* ---------- JSON ---------- */

type AnyObj = Record<string, unknown>;
const str = (v: unknown) => (typeof v === 'string' ? v : v == null ? '' : String(v));

function normQuestion(o: AnyObj, label: string, errors: string[]): Question | null {
  const text = str(o.text ?? o.question ?? o.q).trim();
  const img = str(o.img ?? o.image ?? '') || undefined;
  const rawOpts = (o.options ?? o.opts ?? o.choices) as unknown;
  if (!Array.isArray(rawOpts) || rawOpts.length < 2) { errors.push(`${label}: needs at least 2 options`); return null; }
  const options: Opt[] = rawOpts.map((x) => {
    if (x && typeof x === 'object') {
      const ob = x as AnyObj;
      return { text: str(ob.text ?? ob.label), img: str(ob.img ?? ob.image) || undefined };
    }
    return splitOption(str(x));
  });
  const rawAns = o.ans ?? o.answer ?? o.correct ?? o.correctIndex;
  let ans = -1;
  if (typeof rawAns === 'number') ans = rawAns >= 0 && rawAns < options.length ? Math.floor(rawAns) : -1;
  else ans = resolveAns(str(rawAns), options.length);
  if (ans < 0) { errors.push(`${label}: missing or invalid answer`); return null; }
  if (!text && !img) { errors.push(`${label}: missing question text`); return null; }
  return { id: '', text, img, options, ans, exp: str(o.exp ?? o.explanation ?? o.solution).trim() || undefined };
}

export function parseJson(raw: string): ParseResult {
  const errors: string[] = [];
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { sections: [], errors: ['Invalid JSON file'] }; }
  const root = (Array.isArray(data) ? { questions: data } : data) as AnyObj;
  const sections: Section[] = [];
  const readQs = (arr: unknown, prefix: string): Question[] => {
    if (!Array.isArray(arr)) return [];
    const out: Question[] = [];
    arr.forEach((x, i) => {
      const q = normQuestion((x || {}) as AnyObj, `${prefix}Q${i + 1}`, errors);
      if (q) out.push(q);
    });
    return out;
  };
  if (Array.isArray(root.sections)) {
    (root.sections as AnyObj[]).forEach((s, i) => {
      const qs = readQs(s.questions, `Section ${i + 1} · `);
      if (qs.length) sections.push({ name: str(s.name ?? s.title) || `Section ${i + 1}`, questions: qs });
    });
  } else if (Array.isArray(root.questions)) {
    const qs = readQs(root.questions, '');
    if (qs.length) sections.push({ name: 'General', questions: qs });
  } else errors.push('JSON must contain "sections" or "questions"');
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : undefined);
  const st = (root.settings ?? root) as AnyObj;
  const settings: TestSettings = {
    pattern: st.pattern === 'TCS' || st.pattern === 'Eduquity' ? st.pattern : undefined,
    duration: num(st.duration),
    sectionDuration: num(st.sectionDuration),
    pos: num(st.pos ?? st.positiveMarks),
    neg: num(st.neg ?? st.negativeMarks),
  };
  const hasSettings = Object.values(settings).some((v) => v !== undefined);
  return { title: str(root.title) || undefined, settings: hasSettings ? settings : undefined, sections: assignIds(sections), errors };
}

export function parseAny(raw: string): ParseResult {
  const t = raw.trim();
  if (t.startsWith('{') || t.startsWith('[') && !/^\[\s*(SECTION|TITLE)/i.test(t)) return parseJson(t);
  return parseTxt(raw);
}

export function buildTest(
  p: { title: string; pattern: Pattern; duration: number; sectionDuration: number; pos: number; neg: number },
  sections: Section[],
): Test {
  return { id: uid(), ...p, sections, createdAt: Date.now() };
}

/** Serialise a test (with fixed timing & marks) into a JSON file that re-imports exactly */
export function toJson(t: Test): string {
  return JSON.stringify(
    {
      app: 'TestHub CBT',
      version: 1,
      title: t.title,
      settings: { pattern: t.pattern, duration: t.duration, sectionDuration: t.sectionDuration, pos: t.pos, neg: t.neg },
      sections: t.sections.map((s) => ({
        name: s.name,
        questions: s.questions.map((q) => ({
          text: q.text,
          ...(q.img ? { img: q.img } : {}),
          options: q.options.map((o) => ({ text: o.text, ...(o.img ? { img: o.img } : {}) })),
          ans: LETTERS[q.ans],
          ...(q.exp ? { exp: q.exp } : {}),
        })),
      })),
    },
    null,
    2,
  );
}

/** Serialise a test back into the TXT format (round-trips with parseTxt) */
export function toTxt(t: Test): string {
  const out: string[] = [`[TITLE: ${t.title}]`, ''];
  t.sections.forEach((s) => {
    out.push(`[SECTION: ${s.name}]`, '');
    s.questions.forEach((q, i) => {
      out.push(`Q${i + 1}. ${q.text}`);
      if (q.img) out.push(`Img: ${q.img}`);
      q.options.forEach((o, oi) => out.push(`${LETTERS[oi]}) ${o.text}${o.img ? ` | ${o.img}` : ''}`));
      out.push(`Ans: ${LETTERS[q.ans]}`);
      if (q.exp) out.push(`Exp: ${q.exp}`);
      out.push('');
    });
  });
  return out.join('\n');
}
