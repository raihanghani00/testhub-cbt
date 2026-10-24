import { collection, deleteDoc, doc, getDocs, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import type { Attempt, Progress, Test } from '../types';
import {
  clearProgress, loadAttempts, loadProgress, loadTests, saveAttempts, saveProgress, saveTests,
} from './storage';

/**
 * Firestore layout (one small document per item, so nothing hits the 1 MB doc limit):
 *   users/{uid}                    profile + lastSync
 *   users/{uid}/tests/{testId}     created / imported mock tests
 *   users/{uid}/attempts/{id}      completed test reports
 *   users/{uid}/progress/{testId}  paused progress (question, timers, answers, marks)
 */

let uid: string | null = null;
let onError: ((msg: string) => void) | null = null;

export const setCloudUser = (u: string | null) => { uid = u; };
export const isSignedIn = () => !!uid;
export const setCloudErrorHandler = (fn: ((msg: string) => void) | null) => { onError = fn; };

/** Firestore rejects `undefined` values, so round-trip through JSON */
const clean = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function describeError(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code.includes('permission-denied')) return 'Cloud access was denied. Ask the app owner to allow signed-in users in the Firestore security rules.';
  if (code.includes('unavailable') || code.includes('network')) return 'You appear to be offline. Changes are saved on this device and will sync later.';
  if (code.includes('not-found') || code.includes('failed-precondition')) return 'Cloud Firestore is not enabled for this project yet.';
  return 'Cloud sync failed. Your data is still safe on this device.';
}

async function safe(p: Promise<unknown>) {
  try { await p; } catch (e) { console.warn('[cloud]', e); onError?.(describeError(e)); }
}

const ref = (name: string, id: string) => doc(db, 'users', uid!, name, id);

export const pushTest = (t: Test) =>
  uid ? safe(setDoc(ref('tests', t.id), clean(t), { merge: true })) : Promise.resolve();

export const removeTest = (id: string) =>
  uid ? safe(deleteDoc(ref('tests', id))) : Promise.resolve();

export const pushAttempt = (a: Attempt) =>
  uid ? safe(setDoc(ref('attempts', a.id), clean(a), { merge: true })) : Promise.resolve();

export const removeAttempt = (id: string) =>
  uid ? safe(deleteDoc(ref('attempts', id))) : Promise.resolve();

/** push the locally saved paused progress for a test */
export function pushProgress(testId: string) {
  const p = loadProgress(testId);
  if (!uid || !p) return Promise.resolve();
  return safe(setDoc(ref('progress', testId), clean({ ...p, testId }), { merge: true }));
}

/** clear paused progress locally and in the cloud */
export function clearProgressEverywhere(testId: string) {
  clearProgress(testId);
  return uid ? safe(deleteDoc(ref('progress', testId))) : Promise.resolve();
}

/**
 * Two-way merge. Local data is never lost: items that exist only locally are uploaded,
 * items that exist only in the cloud are downloaded, paused progress keeps the newest copy.
 */
export async function syncAll(profile?: { name: string; email: string }): Promise<{ tests: Test[]; attempts: Attempt[] }> {
  if (!uid) throw new Error('Not signed in');
  const me = uid;
  const [tSnap, aSnap, pSnap] = await Promise.all([
    getDocs(collection(db, 'users', me, 'tests')),
    getDocs(collection(db, 'users', me, 'attempts')),
    getDocs(collection(db, 'users', me, 'progress')),
  ]);
  const writes: Promise<unknown>[] = [];

  // tests
  const tests = new Map<string, Test>();
  tSnap.forEach((d) => tests.set(d.id, d.data() as Test));
  loadTests().forEach((t) => {
    if (!tests.has(t.id)) { tests.set(t.id, t); writes.push(setDoc(ref('tests', t.id), clean(t), { merge: true })); }
  });

  // attempts
  const attempts = new Map<string, Attempt>();
  aSnap.forEach((d) => attempts.set(d.id, d.data() as Attempt));
  loadAttempts().forEach((a) => {
    if (!attempts.has(a.id)) { attempts.set(a.id, a); writes.push(setDoc(ref('attempts', a.id), clean(a), { merge: true })); }
  });

  // paused progress: newest wins
  const cloudProg = new Map<string, Progress>();
  pSnap.forEach((d) => cloudProg.set(d.id, d.data() as Progress));
  const ids = new Set<string>([...cloudProg.keys(), ...[...tests.keys()]]);
  ids.forEach((id) => {
    const c = cloudProg.get(id);
    const l = loadProgress(id);
    if (c && (!l || (c.ts || 0) > (l.ts || 0))) saveProgress(id, { qs: c.qs, timers: c.timers, cur: c.cur, ts: c.ts });
    else if (l && (!c || (l.ts || 0) > (c.ts || 0))) writes.push(setDoc(ref('progress', id), clean({ ...l, testId: id }), { merge: true }));
  });

  if (profile) writes.push(setDoc(doc(db, 'users', me), { ...profile, lastSync: Date.now() }, { merge: true }));
  await Promise.all(writes);

  const mergedTests = [...tests.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const mergedAttempts = [...attempts.values()].sort((a, b) => (b.date || 0) - (a.date || 0));
  saveTests(mergedTests);
  saveAttempts(mergedAttempts);
  return { tests: mergedTests, attempts: mergedAttempts };
}
