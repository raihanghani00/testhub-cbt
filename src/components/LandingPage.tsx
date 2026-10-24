import { useRef, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { I } from './ui';

interface Props {
  dark: boolean;
  onToggleDark: () => void;
}

function friendly(e: unknown): string {
  const code = (e as { code?: string })?.code || '';
  if (code === 'auth/popup-blocked') return 'The sign-in popup was blocked by your browser. Please allow popups and try again.';
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return 'Sign-in was cancelled.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  if (code === 'auth/unauthorized-domain' || code === 'auth/operation-not-allowed')
    return 'Google sign-in is not available on this domain yet.';
  return 'Google sign-in failed. Please try again.';
}

export default function LandingPage({ dark, onToggleDark }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [isRegistering, setIsRegistering] = useState(true);
  const nameRef = useRef<HTMLInputElement>(null);

  const google = async () => {
    if (busy) return;
    setError('');

    if (isRegistering && name.trim().length < 2) {
      setError('Please enter your full name before continuing with Google');
      nameRef.current?.focus();
      return;
    }

    if (isRegistering) {
      localStorage.setItem('testhub_student_name', name.trim());
    }

    setBusy(true);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      setError(friendly(err));
      localStorage.removeItem('testhub_student_name');
    } finally {
      setBusy(false);
    }
  };

  const features = [
    ['stopwatch', 'TCS iON & Eduquity Interface', 'Authentic computer-based test engine with global or section-wise timers'],
    ['layer-group', 'Section-wise Timers', 'Lock sections after time expires, just like real exams'],
    ['chart-line', 'Instant Analytics & Scorecards', 'Sectional scores, accuracy, time-per-question, and full solutions'],
    ['cloud-arrow-up', 'Cloud Sync', 'Your tests, history and paused progress follow you across all devices'],
    ['square-root-variable', 'KaTeX Math Rendering', 'Write formulas in plain text — they render beautifully'],
    ['file-import', 'Upload .TXT Questions', 'Turn a simple text file into a complete mock test in seconds'],
  ];

  return (
    <div className="min-h-[100dvh] flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-white transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grad-primary w-10 h-10 rounded-xl grid place-items-center text-white shadow-lg shadow-indigo-500/30">
              <I n="check-double" />
            </div>
            <div className="leading-tight">
              <div className="font-extrabold text-lg tracking-tight">
                TestHub <span className="grad-text">CBT</span>
              </div>
              <div className="hidden sm:block text-[11px] text-slate-500 dark:text-slate-400 font-medium -mt-0.5">Smart Mock Test Platform</div>
            </div>
          </div>
          <button
            onClick={onToggleDark}
            className="touch-target grid place-items-center rounded-xl hover:bg-slate-100 dark:hover:bg-white/10 transition"
            aria-label="Toggle dark mode"
          >
            <I n={dark ? 'sun' : 'moon'} className={dark ? 'text-amber-300' : 'text-slate-600'} />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative flex-1 flex items-center overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-[0.03] dark:dot-grid-white dark:opacity-5" />
        <div className="absolute -right-32 -top-32 w-96 h-96 rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute -left-24 -bottom-32 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl" />
        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 text-center w-full">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 dark:bg-white/10 text-indigo-700 dark:text-white text-xs font-semibold backdrop-blur border border-indigo-200 dark:border-white/15 transition-colors">
            <I n="bolt" className="text-amber-500 dark:text-amber-300" /> TCS iON &amp; Eduquity style engine
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight leading-[1.05]">
            TestHub <span className="grad-text">CBT</span>
          </h1>
          <p className="mt-3 text-xl sm:text-2xl font-bold text-slate-700 dark:text-slate-300 transition-colors">
            Smart Mock Test Platform
          </p>
          <p className="mt-4 text-slate-500 dark:text-slate-400 max-w-2xl mx-auto text-sm sm:text-base leading-relaxed transition-colors">
            Turn a plain text file into a full-length computer-based mock test with timers,
            sections, review marking and a deep performance report. Built for students preparing
            for competitive exams.
          </p>

          {/* Name input (only shown when registering) */}
          {isRegistering && (
            <div className="mt-7 mx-auto max-w-md text-left animate-fade">
              <label htmlFor="student-name" className="block text-sm font-bold mb-2 text-slate-700 dark:text-slate-200 transition-colors">
                Student Full Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="student-name"
                ref={nameRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); if (error) setError(''); }}
                placeholder="Enter your full real name"
                maxLength={60}
                autoComplete="name"
                className="w-full h-12 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-indigo-500 transition"
              />
            </div>
          )}

          {/* Sign-in toggle */}
          <div className="mt-4">
            <button
              onClick={() => { setIsRegistering((v) => !v); setError(''); setName(''); }}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-300 hover:underline transition-colors"
            >
              {isRegistering ? 'Already registered? Sign in directly' : 'New student? Register here'}
            </button>
          </div>

          {error && (
            <div className="mt-4 mx-auto max-w-md rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 px-4 py-3 text-sm font-semibold text-rose-600 dark:text-rose-300 animate-fade transition-colors">
              <I n="circle-exclamation" className="mr-2" />{error}
            </div>
          )}

          <button
            onClick={google}
            disabled={busy}
            className="mt-5 inline-flex items-center gap-3 bg-white text-slate-900 font-bold px-7 sm:px-8 py-3.5 rounded-2xl shadow-2xl hover:scale-[1.03] active:scale-95 transition disabled:opacity-60 dark:bg-white dark:text-slate-900"
          >
            {busy ? (
              <I n="circle-notch" className="fa-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
                <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.6 5.9c4.4-4.1 7-10.1 7-17.6z" />
                <path fill="#FBBC05" d="M10.5 28.7c-.5-1.5-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.1 0 24s.9 7.6 2.6 10.8l7.9-6.1z" />
                <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
              </svg>
            )}
            {busy ? 'Connecting…' : isRegistering ? 'Continue with Google' : 'Sign In with Google'}
          </button>
          <p className="mt-3 text-xs text-slate-400 dark:text-slate-500 transition-colors">
            {isRegistering ? 'Register — your access is approved by an administrator.' : 'Sign in to access your approved account.'}
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="bg-slate-50 dark:bg-slate-900/60 border-t border-slate-200 dark:border-white/10 py-12 sm:py-16 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <h2 className="text-center text-2xl sm:text-3xl font-extrabold mb-8 sm:mb-12">
            Everything you need to <span className="grad-text">ace your exam</span>
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map(([ic, title, desc]) => (
              <div
                key={title}
                className="rounded-2xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-5 hover:bg-slate-50 dark:hover:bg-white/[0.07] transition animate-fade-up"
              >
                <div className="w-11 h-11 rounded-xl grad-primary grid place-items-center text-white shadow-lg shadow-indigo-500/20 mb-3">
                  <I n={ic} />
                </div>
                <h3 className="font-bold text-base">{title}</h3>
                <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/10 py-6 transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 text-center text-xs text-slate-400 dark:text-slate-500">
          TestHub CBT — Smart Mock Test Platform. Built for competitive exam preparation.
        </div>
      </footer>
    </div>
  );
}
