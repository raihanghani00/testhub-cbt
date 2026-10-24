import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { I } from './ui';
import { Avatar, type AccountUser } from './AccountModal';
import { updateUserName, type UserProfile } from '../lib/roles';

interface Props {
  user: AccountUser;
  profile: UserProfile;
  dark: boolean;
  onToggleDark: () => void;
  onRefresh: () => void;
}

export default function PendingScreen({ user, profile, dark, onToggleDark, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.name);
  const [nameBusy, setNameBusy] = useState(false);
  const [nameError, setNameError] = useState('');
  const blocked = profile.status === 'blocked';

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const logout = async () => { await signOut(auth); };

  const saveName = async () => {
    if (nameInput.trim().length < 2) {
      setNameError('Please enter your full name (at least 2 characters).');
      return;
    }
    setNameBusy(true);
    setNameError('');
    try {
      await updateUserName(profile.uid, nameInput.trim());
      await onRefresh();
      setEditingName(false);
    } catch (e) {
      setNameError((e as Error).message || 'Could not update name. Try again.');
    } finally {
      setNameBusy(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8 transition-colors">
      {/* Theme toggle in top-right corner */}
      <button
        onClick={onToggleDark}
        className="fixed top-4 right-4 z-10 touch-target grid place-items-center rounded-xl w-10 h-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-md hover:bg-slate-100 dark:hover:bg-slate-700 transition"
        aria-label="Toggle dark mode"
      >
        <I n={dark ? 'sun' : 'moon'} className={dark ? 'text-amber-300' : 'text-slate-600'} />
      </button>

      <div className="w-full max-w-md glass card-shadow-lg rounded-3xl p-6 sm:p-8 text-center animate-fade-up">
        {/* Fixed avatar with explicit inline styles */}
        <div
          style={{
            width: '88px',
            height: '88px',
            borderRadius: '50%',
            overflow: 'hidden',
            border: blocked ? '3px solid #f43f5e' : '3px solid #f59e0b',
            margin: '0 auto 16px auto',
            padding: 0,
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: dark ? '#1e293b' : '#e2e8f0',
          }}
        >
          {user.photo ? (
            <img
              src={user.photo}
              alt={user.name}
              referrerPolicy="no-referrer"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: '50%',
                display: 'block',
                margin: 0,
                padding: 0,
                position: 'static',
                transform: 'none',
              }}
            />
          ) : (
            <span
              className="grad-primary text-white font-extrabold uppercase text-2xl"
              style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
            >
              {(user.name || user.email || '?').trim().charAt(0)}
            </span>
          )}
        </div>

        {blocked ? (
          <>
            <div className="mx-auto mt-5 w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400 transition-colors">
              <I n="ban" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold">Access Restricted</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your account has been blocked by an administrator. If you believe this is a mistake,
              please contact the app owner.
            </p>
          </>
        ) : (
          <>
            <div className="mx-auto mt-5 w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400 transition-colors">
              <I n="hourglass-half" />
            </div>
            <h1 className="mt-4 text-xl font-extrabold">Registration Recorded</h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Your account is <b className="text-amber-600 dark:text-amber-400">pending approval</b>.
              An administrator will review your request shortly. Once approved, you'll get full
              access to all tests and features.
            </p>
          </>
        )}

        {/* Name card with Edit Name option */}
        <div className="mt-5 rounded-xl bg-slate-100 dark:bg-slate-900/50 p-4 text-left transition-colors">
          <div className="flex items-center gap-3">
            <I n="user" className="text-slate-400 shrink-0" />
            <div className="min-w-0 flex-1">
              {editingName ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => { setNameInput(e.target.value); setNameError(''); }}
                    placeholder="Enter your full real name"
                    maxLength={60}
                    autoFocus
                    className="w-full h-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
                  />
                  {nameError && <p className="text-xs text-rose-500 font-semibold">{nameError}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={saveName}
                      disabled={nameBusy}
                      className="touch-target px-3 py-1 rounded-lg text-xs font-bold text-white grad-primary disabled:opacity-60 transition"
                    >
                      {nameBusy ? <I n="circle-notch" className="fa-spin" /> : 'Save'}
                    </button>
                    <button
                      onClick={() => { setEditingName(false); setNameError(''); setNameInput(user.name); }}
                      className="touch-target px-3 py-1 rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{user.name || 'Unnamed Student'}</span>
                    {!blocked && (
                      <button
                        onClick={() => { setEditingName(true); setNameInput(user.name); }}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline shrink-0"
                        aria-label="Edit name"
                      >
                        <I n="pen" className="text-[10px]" /> Edit
                      </button>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email || ''}</div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          {!blocked && (
            <button
              onClick={refresh}
              disabled={refreshing}
              className="w-full touch-target rounded-xl font-bold text-sm text-white grad-primary shadow-lg shadow-indigo-500/25 hover:brightness-110 active:scale-95 disabled:opacity-60 transition"
            >
              <I n={refreshing ? 'circle-notch fa-spin' : 'arrows-rotate'} className="mr-2" />
              {refreshing ? 'Checking…' : 'Refresh Status'}
            </button>
          )}
          <button
            onClick={logout}
            className="w-full touch-target rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition-colors"
          >
            <I n="right-from-bracket" className="mr-2" />Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
