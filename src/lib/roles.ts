import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

/** Safely convert Firestore Timestamp, Date, number, or string into readable date. Returns '—' on invalid. */
export function safeFormatDate(val: unknown): string {
  if (val == null) return '—';
  try {
    // Firestore Timestamp: { seconds, nanoseconds } or object with .toDate()
    if (typeof val === 'object' && val !== null) {
      const v = val as { toDate?: () => Date; seconds?: number };
      if (typeof v.toDate === 'function') return new Date(v.toDate()).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    }
    if (val instanceof Date) return val.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    if (typeof val === 'number' && !isNaN(val)) return new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    if (typeof val === 'string') { const d = new Date(val); if (!isNaN(d.getTime())) return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); }
  } catch { /* fall through */ }
  return '—';
}

/** Safely extract a numeric timestamp from Firestore Timestamp, number, or Date. */
function safeTimestamp(val: unknown, fallback: number): number {
  if (val == null) return fallback;
  try {
    if (typeof val === 'object' && val !== null) {
      const v = val as { toDate?: () => Date; seconds?: number };
      if (typeof v.toDate === 'function') return v.toDate().getTime();
      if (typeof v.seconds === 'number') return v.seconds * 1000;
    }
    if (typeof val === 'number' && !isNaN(val)) return val;
    if (val instanceof Date) return val.getTime();
  } catch { /* fall through */ }
  return fallback;
}

/** Normalize a raw Firestore doc into a safe UserProfile with all fallbacks. */
function normalizeProfile(raw: Record<string, unknown>, uid: string, fallbackEmail = ''): UserProfile {
  const email = String(raw.email ?? fallbackEmail ?? '');
  const storedName = typeof localStorage !== 'undefined' ? localStorage.getItem('testhub_student_name') : null;
  return {
    uid: String(raw.uid ?? uid),
    name: String(storedName || raw.name || (email ? email.split('@')[0] : 'Unnamed Student')),
    email,
    photoURL: (raw.photoURL as string | null | undefined) ?? null,
    role: (raw.role as Role) ?? 'student',
    status: (raw.status as UserStatus) ?? 'pending',
    registeredAt: safeTimestamp(raw.registeredAt, Date.now()),
    lastLoginAt: safeTimestamp(raw.lastLoginAt, Date.now()),
  };
}

export const SUPER_ADMIN_EMAILS = ['raihanghani22@gmail.com'];

export type Role = 'super_admin' | 'teacher_admin' | 'student';
export type UserStatus = 'approved' | 'pending' | 'blocked';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  photoURL: string | null;
  role: Role;
  status: UserStatus;
  registeredAt: number;
  lastLoginAt: number;
}

export interface WhitelistEntry {
  email: string;
  role: Role;
  status: UserStatus;
  addedAt: number;
  addedBy: string;
}

const isSuperAdmin = (email: string) =>
  SUPER_ADMIN_EMAILS.some((e) => e.toLowerCase() === email.toLowerCase());

export function isAdmin(role: Role) {
  return role === 'super_admin' || role === 'teacher_admin';
}

/**
 * On every sign-in, upsert the user document in Firestore `users/{uid}`.
 * Super-admin email is always forced to role=super_admin, status=approved.
 * First-time users are checked against `whitelisted_emails` for pre-approval.
 * Existing role/status are preserved on subsequent logins.
 */
export async function upsertUser(u: {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}): Promise<UserProfile> {
  const userRef = doc(db, 'users', u.uid);
  const snap = await getDoc(userRef);
  const email = (u.email || '').toLowerCase();
  const now = Date.now();
  const storedName = typeof localStorage !== 'undefined' ? localStorage.getItem('testhub_student_name') : null;

  if (isSuperAdmin(email)) {
    const profile: UserProfile = {
      uid: u.uid,
      name: u.displayName || email.split('@')[0] || 'Owner',
      email: u.email || '',
      photoURL: u.photoURL,
      role: 'super_admin',
      status: 'approved',
      registeredAt: snap.exists() ? safeTimestamp(snap.data().registeredAt, now) : now,
      lastLoginAt: now,
    };
    await setDoc(userRef, { ...profile }, { merge: true });
    if (storedName) localStorage.removeItem('testhub_student_name');
    return profile;
  }

  if (snap.exists()) {
    const data = snap.data() as Record<string, unknown>;
    // Use stored name only if the Firestore doc has no name or it's a nickname we want to override
    const existingName = String(data.name ?? '');
    const useName = storedName || existingName || u.displayName || email.split('@')[0] || 'Unnamed Student';
    const profile: UserProfile = {
      uid: u.uid,
      name: useName,
      email: u.email || String(data.email ?? '') || '',
      photoURL: u.photoURL ?? (data.photoURL as string | null | undefined) ?? null,
      role: (data.role as Role) ?? 'student',
      status: (data.status as UserStatus) ?? 'pending',
      registeredAt: safeTimestamp(data.registeredAt, now),
      lastLoginAt: now,
    };
    const patch: Record<string, unknown> = { name: profile.name, email: profile.email, photoURL: profile.photoURL, lastLoginAt: now };
    if (storedName) { patch.name = storedName; localStorage.removeItem('testhub_student_name'); }
    await setDoc(userRef, patch, { merge: true });
    return profile;
  }

  // first-time user: check whitelist
  let role: Role = 'student';
  let status: UserStatus = 'pending';
  try {
    const wlRef = doc(db, 'whitelisted_emails', email);
    const wlSnap = await getDoc(wlRef);
    if (wlSnap.exists()) {
      const wl = wlSnap.data() as Partial<WhitelistEntry>;
      if (wl.role === 'teacher_admin') {
        role = 'teacher_admin';
        status = 'approved';
      } else if (wl.role === 'super_admin') {
        role = 'teacher_admin';
        status = 'approved';
      } else {
        role = 'student';
        status = 'approved';
      }
    }
  } catch {
    // whitelist not accessible — default to pending student
  }

  const profile: UserProfile = {
    uid: u.uid,
    name: storedName || u.displayName || email.split('@')[0] || 'Unnamed Student',
    email: u.email || '',
    photoURL: u.photoURL,
    role,
    status,
    registeredAt: now,
    lastLoginAt: now,
  };
  if (storedName) localStorage.removeItem('testhub_student_name');
  await setDoc(userRef, { ...profile }, { merge: true });
  return profile;
}

/** Fetch a single user's profile from Firestore (for refresh). */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return normalizeProfile(snap.data() as Record<string, unknown>, uid);
}

/** Fetch ALL user profiles for the admin panel. */
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  const users: UserProfile[] = [];
  snap.forEach((d) => users.push(normalizeProfile(d.data() as Record<string, unknown>, d.id)));
  return users.sort((a, b) => (b.registeredAt || 0) - (a.registeredAt || 0));
}

/** Admin action: approve a user. Super-admin can never be blocked. */
export async function setUserStatus(
  uid: string,
  status: UserStatus,
  actorEmail: string,
): Promise<void> {
  const targetRef = doc(db, 'users', uid);
  const snap = await getDoc(targetRef);
  if (!snap.exists()) throw new Error('User not found');
  const target = snap.data() as UserProfile;
  if (isSuperAdmin(target.email)) throw new Error('The Super Admin cannot be blocked or demoted.');
  if (status === 'blocked' && target.role === 'super_admin')
    throw new Error('The Super Admin cannot be blocked.');
  void actorEmail;
  await setDoc(targetRef, { status }, { merge: true });
}

/** Admin action: toggle role between teacher_admin and student. Auto-approve on promotion. */
export async function setUserRole(
  uid: string,
  role: Role,
  actorEmail: string,
): Promise<void> {
  const targetRef = doc(db, 'users', uid);
  const snap = await getDoc(targetRef);
  if (!snap.exists()) throw new Error('User not found');
  const target = snap.data() as UserProfile;
  if (isSuperAdmin(target.email)) throw new Error('The Super Admin cannot be demoted.');
  if (role === 'super_admin') throw new Error('Only the configured Super Admin email can hold that role.');
  void actorEmail;
  const patch: Partial<UserProfile> = { role };
  if (role === 'teacher_admin') patch.status = 'approved';
  await setDoc(targetRef, patch, { merge: true });
}

/** Admin action: add an email to the whitelist for instant access on first login. */
export async function addWhitelistEmail(
  email: string,
  role: Role,
  addedBy: string,
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) throw new Error('Email is required');
  const entry: WhitelistEntry = {
    email: cleanEmail,
    role: role === 'super_admin' ? 'teacher_admin' : role,
    status: 'approved',
    addedAt: Date.now(),
    addedBy,
  };
  await setDoc(doc(db, 'whitelisted_emails', cleanEmail), entry, { merge: true });
}

/** Admin action: remove an email from the whitelist. */
export async function removeWhitelistEmail(email: string): Promise<void> {
  await deleteDoc(doc(db, 'whitelisted_emails', email.trim().toLowerCase()));
}

/** Fetch all whitelisted emails. */
export async function fetchWhitelist(): Promise<WhitelistEntry[]> {
  const snap = await getDocs(collection(db, 'whitelisted_emails'));
  const entries: WhitelistEntry[] = [];
  snap.forEach((d) => entries.push(d.data() as WhitelistEntry));
  return entries.sort((a, b) => (b.addedAt || 0) - (a.addedAt || 0));
}

/** Count pending users (for the header badge). */
export async function countPending(): Promise<number> {
  const snap = await getDocs(query(collection(db, 'users')));
  let n = 0;
  snap.forEach((d) => {
    const u = normalizeProfile(d.data() as Record<string, unknown>, d.id);
    if (u.status === 'pending' && !isSuperAdmin(u.email)) n++;
  });
  return n;
}

/** Allow a pending user to update their display name. */
export async function updateUserName(uid: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Name cannot be empty.');
  await updateDoc(doc(db, 'users', uid), { name: trimmed });
}
