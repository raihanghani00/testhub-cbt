import { useCallback, useEffect, useMemo, useState } from 'react';
import { signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { I, Toast } from './ui';
import { Avatar, type AccountUser } from './AccountModal';
import { download } from '../lib/utils';
import {
  type Role,
  type UserProfile,
  type UserStatus,
  type WhitelistEntry,
  addWhitelistEmail,
  fetchAllUsers,
  fetchWhitelist,
  isAdmin,
  removeWhitelistEmail,
  safeFormatDate,
  setUserRole,
  setUserStatus,
} from '../lib/roles';

interface Props {
  me: AccountUser;
  myProfile: UserProfile;
  dark: boolean;
  onToggleDark: () => void;
  onBack: () => void;
  onProfile: () => void;
}

type FilterTab = 'all' | 'pending' | 'approved' | 'admins' | 'blocked';

const ROLE_BADGE: Record<Role, { label: string; cls: string }> = {
  super_admin: { label: 'Owner', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  teacher_admin: { label: 'Teacher/Admin', cls: 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300' },
  student: { label: 'Student', cls: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300' },
};

const STATUS_BADGE: Record<UserStatus, { label: string; cls: string }> = {
  approved: { label: 'Approved', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  pending: { label: 'Pending', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  blocked: { label: 'Blocked', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300' },
};

export default function AdminPanel({ me, myProfile, dark, onToggleDark, onBack, onProfile }: Props) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('all');
  const [toast, setToast] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('student');
  const [inviteBusy, setInviteBusy] = useState(false);
  const [showWhitelist, setShowWhitelist] = useState(false);

  const flash = (m: string) => { setToast(m); window.setTimeout(() => setToast(null), 2500); };

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [u, w] = await Promise.all([fetchAllUsers(), fetchWhitelist()]);
      setUsers(u);
      setWhitelist(w);
    } catch (e) {
      console.warn('[admin] load failed', e);
      flash('Failed to load users. Check your permissions.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const counts = useMemo(() => {
    const pending = users.filter((u) => (u.status ?? 'pending') === 'pending').length;
    const approved = users.filter((u) => (u.status ?? 'pending') === 'approved' && !isAdmin(u.role ?? 'student')).length;
    const admins = users.filter((u) => isAdmin(u.role ?? 'student')).length;
    const blocked = users.filter((u) => (u.status ?? 'pending') === 'blocked').length;
    return { total: users.length, pending, approved, admins, blocked };
  }, [users]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      const name = (u.name || 'Unnamed Student').toLowerCase();
      const email = (u.email || '').toLowerCase();
      if (q && !name.includes(q) && !email.includes(q)) return false;
      if (tab === 'pending') return (u.status ?? 'pending') === 'pending';
      if (tab === 'approved') return (u.status ?? 'pending') === 'approved' && !isAdmin(u.role ?? 'student');
      if (tab === 'admins') return isAdmin(u.role ?? 'student');
      if (tab === 'blocked') return (u.status ?? 'pending') === 'blocked';
      return true;
    });
  }, [users, search, tab]);

  const wrap = async (uid: string, fn: () => Promise<void>, msg: string) => {
    setBusyUid(uid);
    try {
      await fn();
      await reload();
      flash(msg);
    } catch (e) {
      flash((e as Error).message || 'Action failed');
    } finally {
      setBusyUid(null);
    }
  };

  const approve = (u: UserProfile) => wrap(u.uid, () => setUserStatus(u.uid, 'approved', me.email), 'User approved');
  const block = (u: UserProfile) => wrap(u.uid, () => setUserStatus(u.uid, 'blocked', me.email), 'User blocked');
  const makeAdmin = (u: UserProfile) => wrap(u.uid, () => setUserRole(u.uid, 'teacher_admin', me.email), 'Promoted to Admin');
  const removeAdmin = (u: UserProfile) => wrap(u.uid, () => setUserRole(u.uid, 'student', me.email), 'Admin role removed');

  const invite = async () => {
    if (inviteBusy || !inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      await addWhitelistEmail(inviteEmail, inviteRole, me.email);
      await reload();
      flash(`${inviteEmail.trim()} pre-approved as ${inviteRole === 'teacher_admin' ? 'Teacher/Admin' : 'Student'}`);
      setInviteEmail('');
    } catch (e) {
      flash((e as Error).message || 'Failed to add email');
    } finally {
      setInviteBusy(false);
    }
  };

  const removeWhitelist = async (email: string) => {
    try {
      await removeWhitelistEmail(email);
      await reload();
      flash('Invitation removed');
    } catch (e) {
      flash((e as Error).message || 'Failed to remove');
    }
  };

  const exportCsv = () => {
    const header = 'Name,Email,Role,Status,Registration Date\n';
    const rows = users.map((u) => {
      const role = u.role ?? 'student';
      const status = u.status ?? 'pending';
      return `"${(u.name || 'Unnamed Student').replace(/"/g, '""')}","${(u.email || '').replace(/"/g, '""')}","${ROLE_BADGE[role]?.label ?? 'Student'}","${STATUS_BADGE[status]?.label ?? 'Pending'}","${safeFormatDate(u.registeredAt)}"`;
    });
    download('testhub-users.csv', header + rows.join('\n'), 'text/csv');
    flash('CSV downloaded');
  };

  const stats = [
    { label: 'Total Users', value: counts.total, icon: 'users', cls: 'text-indigo-600 bg-indigo-100 dark:bg-indigo-500/15 dark:text-indigo-300' },
    { label: 'Pending', value: counts.pending, icon: 'hourglass-half', cls: 'text-amber-600 bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300' },
    { label: 'Approved Students', value: counts.approved, icon: 'user-check', cls: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300' },
    { label: 'Teachers/Admins', value: counts.admins, icon: 'user-shield', cls: 'text-blue-600 bg-blue-100 dark:bg-blue-500/15 dark:text-blue-300' },
    { label: 'Blocked', value: counts.blocked, icon: 'ban', cls: 'text-rose-600 bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300' },
  ];

  const tabs: { k: FilterTab; label: string; n: number }[] = [
    { k: 'all', label: 'All', n: counts.total },
    { k: 'pending', label: 'Pending', n: counts.pending },
    { k: 'approved', label: 'Approved', n: counts.approved },
    { k: 'admins', label: 'Admins', n: counts.admins },
    { k: 'blocked', label: 'Blocked', n: counts.blocked },
  ];

  return (
    <div className="min-h-[100dvh] dot-grid">
      {/* Header */}
      <header className="sticky top-0 z-30 glass">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={onBack} aria-label="Back to dashboard" className="touch-target grid place-items-center rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition -ml-2">
              <I n="arrow-left" />
            </button>
            <div className="grad-primary w-10 h-10 rounded-xl grid place-items-center text-white shadow-lg shadow-indigo-500/30 shrink-0">
              <I n="user-shield" />
            </div>
            <div className="leading-tight min-w-0">
              <div className="font-extrabold text-lg tracking-tight truncate">Admin Panel</div>
              <div className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5">User &amp; Role Management</div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onToggleDark} className="touch-target grid place-items-center rounded-xl hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition" aria-label="Toggle dark mode">
              <I n={dark ? 'sun' : 'moon'} className={dark ? 'text-amber-300' : 'text-slate-600'} />
            </button>
            <button onClick={onProfile} aria-label="Account" className="touch-target grid place-items-center rounded-full hover:bg-slate-200/70 dark:hover:bg-slate-700/60 transition active:scale-90">
              <span className="w-9 h-9 rounded-full ring-2 ring-indigo-400/60 overflow-hidden block"><Avatar user={me} /></span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16">
        {/* Summary counters */}
        <section className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 animate-fade-up">
          {stats.map(({ label, value, icon, cls }) => (
            <div key={label} className="glass card-shadow rounded-2xl p-4 text-center">
              <div className={`mx-auto w-10 h-10 rounded-xl grid place-items-center text-sm ${cls}`}><I n={icon} /></div>
              <div className="mt-2 text-2xl font-extrabold tabular-nums">{value}</div>
              <div className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">{label}</div>
            </div>
          ))}
        </section>

        {/* Invite bar */}
        <section className="mt-5 glass card-shadow rounded-2xl p-4 animate-fade-up" style={{ animationDelay: '60ms' }}>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 mb-3">
            <I n="envelope-circle-check" className="text-indigo-500" /> Pre-Approve / Invite Email
          </h2>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
              placeholder="student@gmail.com"
              className="flex-1 h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
            />
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as Role)}
              className="h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900/60 px-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-indigo-500/40 transition"
            >
              <option value="student">Student</option>
              <option value="teacher_admin">Teacher / Admin</option>
            </select>
            <button
              onClick={invite}
              disabled={inviteBusy || !inviteEmail.trim()}
              className="touch-target px-5 rounded-xl font-bold text-sm text-white grad-primary shadow-lg shadow-indigo-500/25 hover:brightness-110 active:scale-95 disabled:opacity-50 transition"
            >
              <I n={inviteBusy ? 'circle-notch fa-spin' : 'plus'} className="mr-2" />Add
            </button>
          </div>
          {whitelist.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setShowWhitelist((s) => !s)} className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline">
                {showWhitelist ? 'Hide' : 'Show'} {whitelist.length} pre-approved email{whitelist.length > 1 ? 's' : ''}
              </button>
              {showWhitelist && (
                <div className="mt-2 space-y-1.5 animate-fade">
                  {whitelist.map((w) => (
                    <div key={w.email} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-900/40 px-3 py-2 text-xs">
                      <I n={w.role === 'teacher_admin' ? 'user-shield' : 'user'} className="text-slate-400" />
                      <span className="flex-1 truncate font-medium">{w.email}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                        {w.role === 'teacher_admin' ? 'Admin' : 'Student'}
                      </span>
                      <button onClick={() => removeWhitelist(w.email)} className="w-7 h-7 grid place-items-center rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition" aria-label="Remove invitation">
                        <I n="xmark" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* Search + filter + export */}
        <div className="mt-5 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <I n="magnifying-glass" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full h-11 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 pl-10 pr-3.5 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
            />
          </div>
          <button onClick={exportCsv} className="touch-target px-4 rounded-xl font-semibold text-sm border border-slate-200 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center gap-2 justify-center">
            <I n="file-csv" className="text-emerald-500" /> Export CSV
          </button>
        </div>

        <div className="mt-3 inline-flex p-1 rounded-2xl glass card-shadow flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`touch-target px-3.5 sm:px-4 rounded-xl text-sm font-semibold flex items-center gap-2 transition ${
                tab === t.k ? 'grad-primary text-white shadow-md' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700/50'
              }`}
            >
              {t.label}
              <span className={`text-[11px] px-1.5 py-0.5 rounded-md ${tab === t.k ? 'bg-white/25' : 'bg-slate-200 dark:bg-slate-700'}`}>{t.n}</span>
            </button>
          ))}
        </div>

        {/* User list */}
        <section className="mt-5 space-y-3">
          {loading ? (
            <div className="glass rounded-3xl py-16 text-center text-slate-500 dark:text-slate-400">
              <I n="circle-notch" className="fa-spin text-2xl mb-3" />
              <div className="font-semibold">Loading users…</div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-3xl py-14 text-center text-slate-500 dark:text-slate-400">
              <I n="filter-circle-xmark" className="text-3xl mb-3" />
              <div className="font-semibold">No users match these filters</div>
            </div>
          ) : (
            filtered.map((u, i) => {
              const isSelf = u.uid === myProfile.uid;
              const role = u.role ?? 'student';
      const status = u.status ?? 'pending';
              const isSuper = role === 'super_admin';
              const isBusy = busyUid === u.uid;
              return (
                <div
                  key={u.uid}
                  className="glass card-shadow rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3 animate-fade-up"
                  style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-11 h-11 rounded-full overflow-hidden ring-2 ring-slate-200 dark:ring-slate-600 shrink-0">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.name || 'Unnamed'} referrerPolicy="no-referrer" className="w-full h-full object-cover" />
                      ) : (
                        <span className="w-full h-full grid place-items-center grad-primary text-white font-extrabold uppercase text-sm">
                          {(u.name || u.email || '?').charAt(0)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm truncate">{u.name || 'Unnamed Student'}</span>
                        {isSelf && <span className="text-[10px] font-bold text-indigo-500">(You)</span>}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{u.email || ''}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">Registered {safeFormatDate(u.registeredAt)}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${ROLE_BADGE[role]?.cls ?? ROLE_BADGE.student.cls}`}>
                      {ROLE_BADGE[role]?.label ?? 'Student'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${STATUS_BADGE[status]?.cls ?? STATUS_BADGE.pending.cls}`}>
                      {STATUS_BADGE[status]?.label ?? 'Pending'}
                    </span>
                  </div>

                  {/* Actions */}
                  {!isSuper && !isSelf && (
                    <div className="flex items-center gap-1.5 flex-wrap shrink-0">
                      {status !== 'approved' && (
                        <ActionBtn icon="check" label="Approve" tone="emerald" busy={isBusy} onClick={() => approve(u)} />
                      )}
                      {status !== 'blocked' && (
                        <ActionBtn icon="ban" label="Block" tone="rose" busy={isBusy} onClick={() => block(u)} />
                      )}
                      {role === 'student' ? (
                        <ActionBtn icon="user-shield" label="Make Admin" tone="blue" busy={isBusy} onClick={() => makeAdmin(u)} />
                      ) : (
                        <ActionBtn icon="user-minus" label="Remove Admin" tone="amber" busy={isBusy} onClick={() => removeAdmin(u)} />
                      )}
                    </div>
                  )}
                  {(isSuper || isSelf) && (
                    <div className="text-[10px] text-slate-400 italic shrink-0 sm:w-28 text-right">Protected</div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>

      <Toast msg={toast} />
    </div>
  );
}

function ActionBtn({ icon, label, tone, busy, onClick }: { icon: string; label: string; tone: 'emerald' | 'rose' | 'blue' | 'amber'; busy: boolean; onClick: () => void }) {
  const tones: Record<string, string> = {
    emerald: 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-500/30 dark:hover:bg-emerald-500/10',
    rose: 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-500/30 dark:hover:bg-rose-500/10',
    blue: 'border-blue-200 text-blue-600 hover:bg-blue-50 dark:border-blue-500/30 dark:hover:bg-blue-500/10',
    amber: 'border-amber-200 text-amber-600 hover:bg-amber-50 dark:border-amber-500/30 dark:hover:bg-amber-500/10',
  };
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className="touch-target px-2.5 rounded-lg text-xs font-semibold border transition active:scale-95 disabled:opacity-50"
    >
      {busy ? <I n="circle-notch" className="fa-spin" /> : <I n={icon} className="mr-1 text-[10px]" />}
      {label}
    </button>
  );
}
