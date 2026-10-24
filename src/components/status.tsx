import type { Status } from '../types';

export const STATUS_META: Record<Status, { label: string; cls: string; shape: string }> = {
  not_visited: {
    label: 'Not Visited',
    cls: 'bg-white text-slate-600 border border-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-500',
    shape: 'rounded-lg',
  },
  not_answered: { label: 'Not Answered', cls: 'bg-rose-500 text-white border border-rose-600', shape: 'rounded-t-xl rounded-b-md' },
  answered: { label: 'Answered', cls: 'bg-emerald-500 text-white border border-emerald-600', shape: 'rounded-b-xl rounded-t-md' },
  review: { label: 'Marked for Review', cls: 'bg-violet-600 text-white border border-violet-700', shape: 'rounded-full' },
  ans_review: { label: 'Answered & Marked for Review', cls: 'bg-violet-600 text-white border border-violet-700', shape: 'rounded-full' },
};

export function StatusChip({
  status, children, size = 'md', current = false, className = '',
}: { status: Status; children?: React.ReactNode; size?: 'sm' | 'md'; current?: boolean; className?: string }) {
  const m = STATUS_META[status];
  const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-10 h-10 text-sm';
  return (
    <span
      className={`relative inline-grid place-items-center font-bold shrink-0 transition ${dim} ${m.cls} ${m.shape} ${
        current ? 'ring-2 ring-offset-2 ring-indigo-500 ring-offset-white dark:ring-offset-slate-800 scale-105' : ''
      } ${className}`}
    >
      {children}
      {status === 'ans_review' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white dark:border-slate-800" />
      )}
    </span>
  );
}
