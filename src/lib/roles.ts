import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  deleteDoc,
} from 'firebase/firestore';
import { db } from './firebase';

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

  if (isSuperAdmin(email)) {
    const profile: UserProfile = {
      uid: u.uid,
      name: u.displayName || email.split('@')[0] || 'Owner',
      email: u.email || '',
      photoURL: u.photoURL,
      role: 'super_admin',
      status: 'approved',
      registeredAt: snap.exists() ? (snap.data().registeredAt as number) || now : now,
      lastLoginAt: now,
    };
    await setDoc(userRef, { ...profile }, { merge: true });
    return profile;
  }

  if (snap.exists()) {
    const data = snap.data() as Partial<UserProfile>;
    const profile: UserProfile = {
      uid: u.uid,
      name: u.displayName || data.name || email.split('@')[0] || 'Student',
      email: u.email || data.email || '',
      photoURL: u.photoURL ?? data.photoURL ?? null,
      role: data.role ?? 'student',
      status: data.status ?? 'pending',
      registeredAt: data.registeredAt ?? now,
      lastLoginAt: now,
    };
    await setDoc(userRef, { ...profile }, { merge: true });
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
    name: u.displayName || email.split('@')[0] || 'Student',
    email: u.email || '',
    photoURL: u.photoURL,
    role,
    status,
    registeredAt: now,
    lastLoginAt: now,
  };
  await setDoc(userRef, { ...profile }, { merge: true });
  return profile;
}

/** Fetch a single user's profile from Firestore (for refresh). */
export async function fetchUserProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return snap.data() as UserProfile;
}

/** Fetch ALL user profiles for the admin panel. */
export async function fetchAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, 'users'));
  const users: UserProfile[] = [];
  snap.forEach((d) => users.push(d.data() as UserProfile));
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
    const u = d.data() as UserProfile;
    if (u.status === 'pending' && !isSuperAdmin(u.email)) n++;
  });
  return n;
}
