import { useState } from 'react';
import {
  GoogleAuthProvider, createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword,
  signInWithPopup, signOut, updateProfile,
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { I, Modal } from './ui';

export interface AccountUser {
  uid: string;
  name: string;
  email: string;
  photo: string | null;
}

export type SyncState = 'idle' | 'syncing' | 'synced' | 'error';

interface Props {
  user: AccountUser | null;
  sync: SyncState;
  syncMsg: string;
  onSync: () => void;
  onRefreshUser: () => void;
  onClose: () => void;
}

const field = 'w-full rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-3.5 h-12 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition';

function friendly(e: unknown, google = false): string {
  const code = (e as { code?: string })?.code || '';
  if (google && (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed' || code === 'auth/web-storage-unsupported' || code === 'auth/internal-error'))
    return 'Google sign-in is not available on this domain yet. Please use Email & Password instead.';
  if (code === 'auth/popup-blocked') return 'The sign-in popup was blocked by your browser. Allow popups, or use Email & Password.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  switch (code) {
    case 'auth/invalid-email': return 'That email address does not look right.';
    case 'auth/missing-password': return 'Please enter your password.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials': return 'Incorrect email or password. If you are new, choose “Create Account”.';
    case 'auth/email-already-in-use': return 'An account with this email already exists. Try signing in instead.';
    case 'auth/weak-password': return 'Password is too weak — use at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Please wait a moment and try again.';
    case 'auth/network-request-failed': return 'Network error. Check your connection and try again.';
    case 'auth/operation-not-allowed': return 'Email & Password sign-in is not enabled for this project yet.';
    default: return google ? 'Google sign-in failed. Please use Email & Password instead.' : 'Something went wrong. Please try again.';
  }
}

export function Avatar({ user, size = 'md' }: { user: AccountUser; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-full h-full text-sm';
  return user.photo ? (
    <img src={user.photo} alt={user.name} referrerPolicy="no-referrer" className={`${dim} rounded-full object-cover`} />
  ) : (
    <span className={`${dim} rounded-full grad-primary text-white font-extrabold grid place-items-center uppercase`}>
      {(user.name || user.email || '?').trim().charAt(0)}
    </span>
  );
}

export default function AccountModal({ user, sync, syncMsg, onSync, onRefreshUser, onClose }: Props) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError(''); setInfo('');
    if (mode === 'signup' && !name.trim()) { setError('Please enter your display name.'); return; }
    if (!email.trim()) { setError('Please enter your email address.'); return; }
    if (!password) { setError('Please enter your password.'); return; }
    setBusy(true);
    try {
      if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        await updateProfile(cred.user, { displayName: name.trim() });
        onRefreshUser();
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
      onClose();
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (busy) return;
    setError(''); setInfo(''); setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      onClose();
    } catch (err) {
      setError(friendly(err, true));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setError(''); setInfo('');
    if (!email.trim()) { setError('Enter your email above first, then tap “Forgot password”.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setInfo('Password reset email sent. Check your inbox.');
    } catch (err) { setError(friendly(err)); }
  };

  const logout = async () => {
    await signOut(auth);
    onClose();
  };

  /* ---------- logged in ---------- */
  if (user) {
    const badge =
      sync === 'synced'
        ? { cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', icon: 'cloud-arrow-up', text: 'Synced across all devices' }
        : sync === 'syncing'
          ? { cls: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300', icon: 'arrows-rotate fa-spin', text: 'Syncing…' }
          : sync === 'error'
            ? { cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: 'cloud-bolt', text: 'Sync problem' }
            : { cls: 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200', icon: 'cloud', text: 'Waiting to sync' };
    return (
      <Modal size="sm" onClose={onClose} z={80}>
        <div className="p-6 sm:p-7 pb-safe text-center">
          <div className="relative mx-auto w-16 h-16">
            <Avatar user={user} size="lg" />
          </div>
          <h2 className="mt-4 text-xl font-extrabold break-words">{user.name}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 break-all">{user.email}</p>
          <span className={`mt-4 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold ${badge.cls}`}>
            <I n={badge.icon} /> {badge.text}
          </span>
          {sync === 'error' && syncMsg && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{syncMsg}</p>}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">Your mock tests, history and paused tests follow you to PC, tablet and mobile.</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button onClick={logout} className="touch-target rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition">
              <I n="right-from-bracket" className="mr-2" />Logout
            </button>
            <button onClick={onSync} disabled={sync === 'syncing'} className="touch-target rounded-xl font-bold text-sm text-white grad-primary shadow-lg shadow-indigo-500/25 hover:brightness-110 disabled:opacity-60 transition">
              <I n="arrows-rotate" className={`mr-2 ${sync === 'syncing' ? 'fa-spin' : ''}`} />Sync Now
            </button>
          </div>
          <button onClick={onClose} className="mt-3 touch-target w-full rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition">Close</button>
        </div>
      </Modal>
    );
  }

  /* ---------- logged out ---------- */
  return (
    <Modal size="sm" onClose={onClose} z={80}>
      <div className="flex-1 overflow-y-auto thin-scroll p-6 sm:p-7 pb-safe">
        <div className="flex items-start justify-between">
          <div className="grad-primary w-12 h-12 rounded-2xl grid place-items-center text-white text-lg shadow-lg shadow-indigo-500/25"><I n="user-graduate" /></div>
          <button onClick={onClose} aria-label="Close" className="touch-target grid place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 -mt-2 -mr-2"><I n="xmark" className="text-lg" /></button>
        </div>
        <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{mode === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Sign in to sync your tests, history and paused progress across all your devices.</p>

        <div className="mt-5 grid grid-cols-2 p-1 rounded-xl bg-slate-100 dark:bg-slate-900/50">
          {([['signin', 'Sign In'], ['signup', 'Create Account']] as const).map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setMode(k); setError(''); setInfo(''); }}
              className={`min-h-[40px] rounded-lg text-sm font-bold transition ${mode === k ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
              {l}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3" noValidate>
          {mode === 'signup' && (
            <input className={field} placeholder="Display name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
          )}
          <input className={field} type="email" placeholder="Email address" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <div className="relative">
            <input className={`${field} pr-12`} type={show ? 'text' : 'password'} placeholder="Password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 grid place-items-center text-slate-400 hover:text-slate-600">
              <I n={show ? 'eye-slash' : 'eye'} />
            </button>
          </div>

          {error && (
            <div role="alert" className="flex gap-2 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 px-3.5 py-2.5 text-xs font-semibold text-rose-700 dark:text-rose-300 animate-fade">
              <I n="circle-exclamation" className="mt-0.5" /> <span>{error}</span>
            </div>
          )}
          {info && (
            <div className="flex gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 px-3.5 py-2.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 animate-fade">
              <I n="circle-check" className="mt-0.5" /> <span>{info}</span>
            </div>
          )}

          <button type="submit" disabled={busy} className="w-full touch-target rounded-xl font-bold text-sm text-white grad-primary shadow-lg shadow-indigo-500/25 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition">
            {busy ? <I n="circle-notch" className="fa-spin" /> : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>
          {mode === 'signin' && (
            <button type="button" onClick={reset} className="w-full text-center text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline min-h-[32px]">Forgot password?</button>
          )}
        </form>

        <div className="my-4 flex items-center gap-3 text-[11px] font-bold uppercase tracking-wide text-slate-400">
          <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" /> or <span className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
        </div>

        <button onClick={google} disabled={busy} className="w-full touch-target rounded-xl font-semibold text-sm border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900/40 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-center gap-3 disabled:opacity-60 transition active:scale-[0.98]">
          <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z"/><path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z"/><path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z"/></svg>
          Continue with Google
        </button>
      </div>
    </Modal>
  );
}
