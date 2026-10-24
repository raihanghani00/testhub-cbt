import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { I } from './ui';
import { Avatar, type AccountUser } from './AccountModal';
import type { UserProfile } from '../lib/roles';

interface Props {
  user: AccountUser;
  profile: UserProfile;
  onRefresh: () => void;
}

export default function PendingScreen({ user, profile, onRefresh }: Props) {
  const [refreshing, setRefreshing] = useState(false);
  const blocked = profile.status === 'blocked';

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  const logout = async () => { await signOut(auth); };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4 py-8">
      <div className="w-full max-w-md glass card-shadow-lg rounded-3xl p-6 sm:p-8 text-center animate-fade-up">
        <div className={`mx-auto w-20 h-20 rounded-full overflow-hidden ring-4 ${blocked ? 'ring-rose-300 dark:ring-rose-500/30' : 'ring-amber-300 dark:ring-amber-500/30'}`}>
          <Avatar user={user} size="lg" />
        </div>

        {blocked ? (
          <>
            <div className="mx-auto mt-5 w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400">
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
            <div className="mx-auto mt-5 w-14 h-14 rounded-2xl grid place-items-center text-2xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
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

        <div className="mt-5 rounded-xl bg-slate-100 dark:bg-slate-900/50 p-4 text-left">
          <div className="flex items-center gap-3">
            <I n="user" className="text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-bold text-sm truncate">{user.name}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</div>
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
            className="w-full touch-target rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition"
          >
            <I n="right-from-bracket" className="mr-2" />Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}
