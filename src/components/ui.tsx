import { useEffect, useMemo, useState, type ReactNode } from 'react';
import katex from 'katex';

/** Font Awesome icon helper */
export function I({ n, className = '', style }: { n: string; className?: string; style?: React.CSSProperties }) {
  return <i className={`fa-solid fa-${n} ${className}`} style={style} aria-hidden="true" />;
}

/** Renders text with $inline$ and $$display$$ KaTeX math */
export function RichText({ text, className = '' }: { text: string; className?: string }) {
  const parts = useMemo(() => {
    const out: { t: 'text' | 'math' | 'display'; v: string }[] = [];
    const re = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ t: 'text', v: text.slice(last, m.index) });
      if (m[1] !== undefined) out.push({ t: 'display', v: m[1] });
      else out.push({ t: 'math', v: m[2] });
      last = m.index + m[0].length;
    }
    if (last < text.length) out.push({ t: 'text', v: text.slice(last) });
    return out.map((p) => {
      if (p.t === 'text') return p;
      try {
        return { t: p.t, v: katex.renderToString(p.v, { throwOnError: false, displayMode: p.t === 'display' }) };
      } catch {
        return { t: 'text' as const, v: p.v };
      }
    });
  }, [text]);
  return (
    <span className={`whitespace-pre-wrap break-words ${className}`}>
      {parts.map((p, i) =>
        p.t === 'text' ? <span key={i}>{p.v}</span> : <span key={i} dangerouslySetInnerHTML={{ __html: p.v }} />,
      )}
    </span>
  );
}

/** Image with zoom badge + full-screen dark overlay */
export function ZoomImg({ src, className = '', alt = 'Question figure' }: { src: string; className?: string; alt?: string }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [open]);
  if (failed) {
    return (
      <div className="flex items-center gap-2 text-xs text-slate-400 py-2">
        <I n="image" /> Image could not be loaded
      </div>
    );
  }
  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        className={`relative inline-block group rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-white ${className}`}
      >
        <img src={src} alt={alt} onError={() => setFailed(true)} className="block max-h-72 max-w-full object-contain" />
        <span className="absolute bottom-2 right-2 grid place-items-center w-8 h-8 rounded-lg bg-slate-900/70 text-white text-xs backdrop-blur group-hover:bg-indigo-600 transition">
          <I n="magnifying-glass-plus" />
        </span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/95 grid place-items-center p-4 animate-fade cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <button
            className="absolute top-4 right-4 touch-target grid place-items-center rounded-full bg-white/10 text-white hover:bg-white/20"
            onClick={() => setOpen(false)}
            aria-label="Close"
          >
            <I n="xmark" className="text-lg" />
          </button>
          <img src={src} alt={alt} className="max-h-[90dvh] max-w-[94vw] object-contain rounded-lg bg-white" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}

/** Modal: centered on desktop, bottom-sheet on mobile */
export function Modal({
  children, onClose, size = 'md', z = 60, heavyBlur = false,
}: { children: ReactNode; onClose?: () => void; size?: 'sm' | 'md' | 'lg' | 'xl'; z?: number; heavyBlur?: boolean }) {
  const w = { sm: 'sm:max-w-sm', md: 'sm:max-w-lg', lg: 'sm:max-w-2xl', xl: 'sm:max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 flex items-end sm:items-center justify-center animate-fade" style={{ zIndex: z }}>
      <div className={`absolute inset-0 ${heavyBlur ? 'bg-black/75 backdrop-blur-xl' : 'bg-slate-950/60 backdrop-blur-sm'}`} onClick={onClose} />
      <div
        className={`relative w-full ${w} max-h-[92dvh] flex flex-col bg-white dark:bg-slate-800 rounded-t-3xl sm:rounded-3xl card-shadow-lg border border-slate-200/70 dark:border-slate-700 animate-sheet sm:animate-pop overflow-hidden`}
      >
        {children}
      </div>
    </div>
  );
}

export function PatternBadge({ pattern, className = '' }: { pattern: string; className?: string }) {
  const tcs = pattern === 'TCS';
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
        tcs
          ? 'bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300'
          : 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300'
      } ${className}`}
    >
      <I n={tcs ? 'stopwatch' : 'layer-group'} className="text-[10px]" />
      {pattern}
    </span>
  );
}

export function ConfirmDialog({
  title, message, confirmLabel, danger, icon, onConfirm, onCancel,
}: { title: string; message: string; confirmLabel: string; danger?: boolean; icon?: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <Modal size="sm" onClose={onCancel} z={80}>
      <div className="p-6 text-center">
        <div className={`mx-auto mb-4 grid place-items-center w-14 h-14 rounded-2xl text-xl ${danger ? 'bg-rose-100 text-rose-600 dark:bg-rose-500/15' : 'bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15'}`}>
          <I n={icon ?? (danger ? 'trash-can' : 'rotate-right')} />
        </div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">{message}</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button onClick={onCancel} className="touch-target rounded-xl font-semibold text-sm bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 transition">
            Cancel
          </button>
          <button onClick={onConfirm} className={`touch-target rounded-xl font-semibold text-sm text-white transition ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'grad-primary hover:opacity-90'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

export function Toast({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-24 z-[90] px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-medium shadow-2xl animate-pop flex items-center gap-2 max-w-[90vw]">
      <I n="circle-info" className="text-sky-400" /> {msg}
    </div>
  );
}
