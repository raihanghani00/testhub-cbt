import type { Attempt, Progress, Test } from '../types';

let uid: string | null = null;
export const setStorageUid = (u: string | null) => { uid = u; };

const K_THEME = 'testhub-theme';
const K_NAME = 'testhub-name';

const LEGACY_KEYS = ['testhub-tests', 'testhub-attempts', 'testhub-seeded'];

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

const testsKey = () => (uid ? `testhub-tests-${uid}` : null);
const attemptsKey = () => (uid ? `testhub-attempts-${uid}` : null);
const progKey = (id: string) => (uid ? `exam-progress-${uid}-${id}` : null);

export const loadTests = (): Test[] => {
  const k = testsKey();
  return k ? read<Test[]>(k, []) : [];
};
export const saveTests = (t: Test[]): boolean => {
  const k = testsKey();
  return k ? write(k, t) : false;
};

export const loadAttempts = (): Attempt[] => {
  const k = attemptsKey();
  return k ? read<Attempt[]>(k, []) : [];
};
export function saveAttempts(a: Attempt[]) {
  const k = attemptsKey();
  if (!k) return;
  let list = a;
  while (list.length && !write(k, list)) list = list.slice(0, -1);
}

export const loadProgress = (id: string): Progress | null => {
  const k = progKey(id);
  return k ? read<Progress | null>(k, null) : null;
};
export const saveProgress = (id: string, p: Progress): boolean => {
  const k = progKey(id);
  return k ? write(k, p) : false;
};
export const clearProgress = (id: string) => {
  const k = progKey(id);
  if (k) try { localStorage.removeItem(k); } catch { /* ignore */ }
};
export const hasProgress = (id: string): boolean => !!loadProgress(id);

export const loadTheme = (): boolean => {
  try {
    const t = localStorage.getItem(K_THEME);
    if (t) return t === 'dark';
  } catch { /* ignore */ }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
};
export const saveTheme = (dark: boolean) => {
  try { localStorage.setItem(K_THEME, dark ? 'dark' : 'light'); } catch { /* ignore */ }
};

export const getName = () => {
  try { return localStorage.getItem(K_NAME) || 'Guest Candidate'; } catch { return 'Guest Candidate'; }
};
export const setName = (n: string) => {
  try { localStorage.setItem(K_NAME, n); } catch { /* ignore */ }
};

export const purgeLegacyKeys = () => {
  for (const key of LEGACY_KEYS) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  }
};
