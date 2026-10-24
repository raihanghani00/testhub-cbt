import { useCallback, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type { Attempt, Test, View } from './types';
import Dashboard from './components/Dashboard';
import CreateModal from './components/CreateModal';
import Instructions from './components/Instructions';
import Exam from './components/Exam';
import Result from './components/Result';
import { ConfirmDialog, Toast } from './components/ui';
import AccountModal, { type AccountUser, type SyncState } from './components/AccountModal';
import LandingPage from './components/LandingPage';
import PendingScreen from './components/PendingScreen';
import AdminPanel from './components/AdminPanel';
import { auth } from './lib/firebase';
import {
  clearProgressEverywhere, pushAttempt, pushTest, removeAttempt, removeTest, setCloudErrorHandler, setCloudUser, syncAll,
} from './lib/cloud';
import {
  getName, hasProgress, isSeeded, loadAttempts, loadTests, loadTheme, markSeeded,
  saveAttempts, saveTests, saveTheme, setName,
} from './lib/storage';
import { buildTest, parseTxt, toJson } from './lib/parser';
import { SAMPLE_TXT } from './lib/sample';
import { download } from './lib/utils';
import { type UserProfile, countPending, fetchUserProfile, isAdmin, upsertUser } from './lib/roles';

interface Confirm {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  icon?: string;
  onConfirm: () => void;
}

function describe(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code.includes('permission-denied')) return 'Cloud access was denied. Ask the app owner to allow signed-in users in the Firestore security rules.';
  if (code.includes('unavailable') || code.includes('network')) return 'You appear to be offline. Changes are saved on this device and will sync later.';
  if (code.includes('not-found') || code.includes('failed-precondition')) return 'Cloud Firestore is not enabled for this project yet.';
  return 'Cloud sync failed. Your data is still safe on this device.';
}

function seedTests(): Test[] {
  const existing = loadTests();
  if (existing.length || isSeeded()) return existing;
  const { sections } = parseTxt(SAMPLE_TXT);
  // fixed ids so the sample tests do not duplicate when syncing between devices
  const seeded = [
    { ...buildTest({ title: 'SSC CGL Tier-I · Full Mock 01', pattern: 'TCS', duration: 30, sectionDuration: 0, pos: 2, neg: 0.5 }, sections), id: 'sample-ssc-tcs' },
    { ...buildTest({ title: 'Banking Prelims · Sectional Mock', pattern: 'Eduquity', duration: 30, sectionDuration: 10, pos: 1, neg: 0.25 }, sections), id: 'sample-bank-edu' },
  ];
  saveTests(seeded);
  markSeeded();
  return seeded;
}

export default function App() {
  const [tests, setTests] = useState<Test[]>(seedTests);
  const [attempts, setAttempts] = useState<Attempt[]>(loadAttempts);
  const [dark, setDark] = useState<boolean>(loadTheme);
  const [view, setView] = useState<View>('dashboard');
  const [active, setActive] = useState<Test | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [resume, setResume] = useState(false);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [dashTab, setDashTab] = useState<'tests' | 'history'>('tests');
  const [toast, setToast] = useState<string | null>(null);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [account, setAccount] = useState(false);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const viewRef = useRef<View>(view);
  viewRef.current = view;
  const lastSync = useRef(0);

  const toAccountUser = (u: User): AccountUser => ({
    uid: u.uid,
    name: u.displayName || (u.email ? u.email.split('@')[0] : 'Student'),
    email: u.email || '',
    photo: u.photoURL,
  });

  const doSync = useCallback(async (silent = false) => {
    const u = auth.currentUser;
    if (!u) return;
    if (!silent) setSyncState('syncing');
    try {
      const r = await syncAll({ name: u.displayName || '', email: u.email || '' });
      setTests(r.tests);
      setAttempts(r.attempts);
      setSyncState('synced');
      setSyncMsg('');
      lastSync.current = Date.now();
    } catch (e) {
      console.warn('[sync]', e);
      setSyncState('error');
      setSyncMsg(describe(e));
    }
  }, []);

  useEffect(() => {
    setCloudErrorHandler((m) => { setSyncState('error'); setSyncMsg(m); });
    const off = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setCloudUser(u.uid);
        setUser(toAccountUser(u));
        if (getName() === 'Guest Candidate') setName(u.displayName || (u.email ? u.email.split('@')[0] : 'Student'));
        try {
          const p = await upsertUser({ uid: u.uid, displayName: u.displayName, email: u.email, photoURL: u.photoURL });
          setProfile(p);
          if (p.status === 'approved') {
            doSync();
            if (isAdmin(p.role)) {
              countPending().then(setPendingCount).catch(() => {});
            }
          }
        } catch (e) {
          console.warn('[roles] upsert failed', e);
          setProfile(null);
        }
      } else {
        setCloudUser(null);
        setUser(null);
        setProfile(null);
        setPendingCount(0);
        setSyncState('idle');
      }
      setAuthReady(true);
    });
    return () => { off(); setCloudErrorHandler(null); };
  }, [doSync]);

  // pull changes made on other devices when the tab becomes active again
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'visible' && auth.currentUser && viewRef.current === 'dashboard' && Date.now() - lastSync.current > 30000) doSync(true);
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [doSync]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    saveTheme(dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0f172a' : '#2563eb');
  }, [dark]);

  // Browser back: exam handles its own (pause modal); admin returns to dashboard; other views return to dashboard
  useEffect(() => {
    const h = () => {
      if (viewRef.current === 'admin') {
        setView('dashboard');
      } else if (viewRef.current !== 'exam' && viewRef.current !== 'dashboard') {
        setView('dashboard');
      }
    };
    window.addEventListener('popstate', h);
    return () => window.removeEventListener('popstate', h);
  }, []);

  const go = useCallback((v: View) => {
    if (v !== 'dashboard') history.pushState({ v }, '');
    setView(v);
    window.scrollTo({ top: 0 });
  }, []);

  const flash = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast(null), 2200);
  };

  const updateTests = (next: Test[]) => {
    setTests(next);
    if (!saveTests(next)) flash('Storage is full — the test could not be saved');
  };

  const startInstructions = (t: Test) => { setActive(t); go('instructions'); };

  const handleRestart = (t: Test) => {
    if (!hasProgress(t.id)) { startInstructions(t); return; }
    setConfirm({
      title: 'Restart this test?',
      message: 'Your paused progress will be discarded and the test will start from scratch.',
      confirmLabel: 'Restart',
      onConfirm: () => { clearProgressEverywhere(t.id); setConfirm(null); startInstructions(t); },
    });
  };

  const handleDelete = (t: Test) =>
    setConfirm({
      title: 'Delete this test?',
      message: `“${t.title}” and any paused progress will be removed. Past attempts stay in your history.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => { clearProgressEverywhere(t.id); removeTest(t.id); updateTests(tests.filter((x) => x.id !== t.id)); setConfirm(null); },
    });

  const handleDeleteAttempt = (a: Attempt) =>
    setConfirm({
      title: 'Delete this attempt?',
      message: 'This report will be permanently removed from your history.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => {
        const next = attempts.filter((x) => x.id !== a.id);
        setAttempts(next); saveAttempts(next); removeAttempt(a.id); setConfirm(null);
      },
    });

  const handleSubmit = (a: Attempt) => {
    const next = [a, ...attempts];
    setAttempts(next);
    saveAttempts(next);
    pushAttempt(a);
    setAttempt(a);
    go('result');
  };

  const backHome = (tab: 'tests' | 'history') => { setDashTab(tab); setView('dashboard'); };

  const goMockTests = () => {
    setDashTab('tests');
    setView('dashboard');
    window.setTimeout(() => {
      const el = document.getElementById('mock-tests');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 80);
  };

  const refreshProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    const p = await fetchUserProfile(auth.currentUser.uid);
    if (p) {
      setProfile(p);
      if (isAdmin(p.role)) {
        countPending().then(setPendingCount).catch(() => {});
      }
    }
  }, []);

  // Loading screen while Firebase determines auth state
  if (!authReady) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-slate-50 dark:bg-slate-950">
        <div className="text-center">
          <div className="grad-primary w-14 h-14 rounded-2xl grid place-items-center text-white text-xl shadow-lg shadow-indigo-500/30 mx-auto">
            <i className="fa-solid fa-check-double fa-spin" />
          </div>
          <p className="mt-4 text-sm font-semibold text-slate-500 dark:text-slate-400">Loading TestHub CBT…</p>
        </div>
      </div>
    );
  }

  // Not signed in — show landing page
  if (!user) {
    return <LandingPage dark={dark} onToggleDark={() => setDark((d) => !d)} />;
  }

  // Signed in but pending or blocked
  if (profile && (profile.status === 'pending' || profile.status === 'blocked')) {
    return <PendingScreen user={user} profile={profile} dark={dark} onToggleDark={() => setDark((d) => !d)} onRefresh={refreshProfile} />;
  }

  return (
    <>
      {view === 'admin' && profile && isAdmin(profile.role) && (
        <AdminPanel
          me={user}
          myProfile={profile}
          dark={dark}
          onToggleDark={() => setDark((d) => !d)}
          onBack={() => go('dashboard')}
          onProfile={() => setAccount(true)}
        />
      )}

      {view === 'dashboard' && (
        <Dashboard
          key={dashTab}
          tests={tests}
          attempts={attempts}
          dark={dark}
          initialTab={dashTab}
          user={user}
          isAdmin={!!profile && isAdmin(profile.role)}
          pendingCount={pendingCount}
          onAdmin={() => go('admin')}
          onProfile={() => setAccount(true)}
          onToggleDark={() => setDark((d) => !d)}
          onCreate={() => setCreating(true)}
          onStart={startInstructions}
          onRestart={handleRestart}
          onDelete={handleDelete}
          onExport={(t) =>
            setConfirm({
              title: 'Download test file?',
              message: `This downloads “${t.title}” as a .json test file with its questions, answers, timing and marks. Share it with students only through the Import option.`,
              confirmLabel: 'Download',
              icon: 'file-arrow-down',
              onConfirm: () => {
                download(`${t.title.replace(/[^\w\-]+/g, '_')}.json`, toJson(t), 'application/json');
                setConfirm(null);
                flash('Test JSON downloaded');
              },
            })
          }
          onOpenAttempt={(a) => { setAttempt(a); go('history-report'); }}
          onDeleteAttempt={handleDeleteAttempt}
        />
      )}

      {view === 'instructions' && active && (
        <Instructions
          test={active}
          onBack={() => backHome('tests')}
          onBegin={() => { clearProgressEverywhere(active.id); setResume(false); go('exam'); }}
          onResume={() => { setResume(true); go('exam'); }}
        />
      )}

      {view === 'exam' && active && (
        <Exam
          key={active.id + (resume ? 'r' : 'n') + attempts.length}
          test={active}
          resume={resume}
          onSubmit={handleSubmit}
          onExit={() => backHome('tests')}
        />
      )}

      {(view === 'result' || view === 'history-report') && attempt && (
        <Result
          attempt={attempt}
          fromHistory={view === 'history-report'}
          onHome={() => backHome(view === 'history-report' ? 'history' : 'tests')}
          onMockTests={goMockTests}
          onRetake={() => {
            const t = tests.find((x) => x.id === attempt.testId) ?? attempt.test;
            startInstructions(t);
          }}
        />
      )}

      {creating && (
        <CreateModal
          onClose={() => setCreating(false)}
          onCreate={(t) => {
            updateTests([t, ...tests]);
            pushTest(t);
            setCreating(false);
            setDashTab('tests');
            flash('Test created successfully');
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          danger={confirm.danger}
          icon={confirm.icon}
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}

      {account && (
        <AccountModal
          user={user}
          sync={syncState}
          syncMsg={syncMsg}
          onSync={() => doSync()}
          onRefreshUser={() => { if (auth.currentUser) setUser(toAccountUser(auth.currentUser)); }}
          onClose={() => setAccount(false)}
        />
      )}

      <Toast msg={toast} />
    </>
  );
}
