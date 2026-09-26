import { type ReactNode } from 'react';

// ── Field ─────────────────────────────────────────────────────────
export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 flex items-center gap-1">⚠ {error}</p>}
    </div>
  );
}

// ── Input / Select ────────────────────────────────────────────────
export function inputCls(hasError = false) {
  return [
    'w-full rounded-lg border px-3 py-2 text-sm text-slate-100 placeholder-slate-500',
    'bg-[#1e2536] outline-none transition-all duration-150',
    'focus:ring-2',
    hasError
      ? 'border-red-500/60 focus:ring-red-500/20 focus:border-red-500'
      : 'border-[#2a3347] focus:ring-indigo-500/25 focus:border-indigo-500',
  ].join(' ');
}

export function selectCls() {
  return [
    'w-full rounded-lg border border-[#2a3347] bg-[#1e2536]',
    'px-3 py-2 text-sm text-slate-100 outline-none transition-all duration-150',
    'focus:ring-2 focus:ring-indigo-500/25 focus:border-indigo-500',
  ].join(' ');
}

// ── Button ────────────────────────────────────────────────────────
export function Btn({
  children, onClick, type = 'button', variant = 'primary', disabled, className = '',
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string;
}) {
  const base = [
    'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium',
    'transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed',
    'active:scale-[0.97]',
  ].join(' ');

  const variants = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-sm shadow-indigo-900/40',
    ghost:   'border border-[#2a3347] text-slate-300 hover:bg-[#1e2536] hover:border-slate-500',
    danger:  'bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

// ── Status Badge ─────────────────────────────────────────────────
export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:    'bg-slate-500/10 text-slate-400 border border-slate-500/20',
    waiting:  'bg-amber-500/10  text-amber-400  border border-amber-500/20',
    ready:    'bg-teal-500/10   text-teal-400   border border-teal-500/20',
    done:     'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    canceled: 'bg-red-500/10   text-red-400    border border-red-500/20',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize tracking-wide ${map[status] ?? 'bg-slate-700 text-slate-300'}`}>
      {status}
    </span>
  );
}

// ── API Error ─────────────────────────────────────────────────────
export function ApiErr({ msg }: { msg: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-red-500/8 border border-red-500/20 px-4 py-3 text-sm text-red-400 animate-fade-in">
      <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      </svg>
      {msg}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-[#161b27] border border-[#2a3347] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] animate-modal-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2a3347] shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{title}</h2>
          <button
            onClick={onClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-[#252d3d] transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

// ── Table ─────────────────────────────────────────────────────────
export function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-[#2a3347] shadow-sm">
      <table className="w-full text-sm text-slate-300">
        <thead className="bg-[#1e2536] text-xs uppercase tracking-wider text-slate-500 border-b border-[#2a3347]">
          <tr>
            {heads.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a3347]/60 bg-[#161b27]">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

export function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-14 text-center">
        <div className="flex flex-col items-center gap-3 text-slate-600">
          <svg className="w-10 h-10 opacity-40" fill="none" viewBox="0 0 48 48" stroke="currentColor" strokeWidth={1.5}>
            <rect x="8" y="14" width="32" height="24" rx="3" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 20h32M16 8l-4 6M32 8l4 6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M18 30h12" strokeLinecap="round"/>
          </svg>
          <span className="text-sm">{msg}</span>
        </div>
      </td>
    </tr>
  );
}

// ── Status workflow ───────────────────────────────────────────────
export const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'] as const;
export type DocStatus = typeof STATUSES[number];

export function StatusSelect({
  status, onChange, disabled,
}: {
  status: DocStatus; onChange: (next: DocStatus) => void; disabled?: boolean;
}) {
  const colors: Record<DocStatus, string> = {
    draft:    'text-slate-400',
    waiting:  'text-amber-400',
    ready:    'text-teal-400',
    done:     'text-emerald-400',
    canceled: 'text-red-400',
  };

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as DocStatus;
    if (next === status) return;
    if (next === 'done'     && !window.confirm('Transitioning to Done will update stock levels. Continue?')) return;
    if (next === 'canceled' && !window.confirm('Mark this record as Canceled?')) return;
    onChange(next);
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={disabled || status === 'done' || status === 'canceled'}
      className={`rounded-lg border border-[#2a3347] bg-[#1e2536] px-2 py-1 text-xs font-medium
        outline-none focus:ring-2 focus:ring-indigo-500/25 disabled:opacity-40 disabled:cursor-not-allowed
        transition-all duration-150 ${colors[status]}`}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}
          disabled={s === 'draft' && ['done','waiting','ready','canceled'].includes(status)}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
