import type { Attempt, Progress, Test } from '../types';

const K_TESTS = 'testhub-tests';
const K_ATTEMPTS = 'testhub-attempts';
const K_THEME = 'testhub-theme';
const K_NAME = 'testhub-name';
const K_SEED = 'testhub-seeded';
const progKey = (id: string) => `exam-progress-${id}`;

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

export const loadTests = () => read<Test[]>(K_TESTS, []);
export const saveTests = (t: Test[]) => write(K_TESTS, t);

export const loadAttempts = () => read<Attempt[]>(K_ATTEMPTS, []);
export function saveAttempts(a: Attempt[]) {
  // quota fallback: drop oldest attempts until it fits
  let list = a;
  while (list.length && !write(K_ATTEMPTS, list)) list = list.slice(0, -1);
}

export const loadProgress = (id: string) => read<Progress | null>(progKey(id), null);
export const saveProgress = (id: string, p: Progress) => write(progKey(id), p);
export const clearProgress = (id: string) => {
  try { localStorage.removeItem(progKey(id)); } catch { /* ignore */ }
};
export const hasProgress = (id: string) => !!loadProgress(id);

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

export const isSeeded = () => { try { return !!localStorage.getItem(K_SEED); } catch { return true; } };
export const markSeeded = () => { try { localStorage.setItem(K_SEED, '1'); } catch { /* ignore */ } };
