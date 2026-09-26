import { type ReactNode } from 'react';

export function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

export function inputCls(hasError = false) {
  return `w-full rounded-lg border bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition ${
    hasError ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-600 focus:ring-blue-500/40 focus:border-blue-500'
  }`;
}

export function selectCls() {
  return 'w-full rounded-lg border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-blue-500 transition';
}

export function Btn({
  children, onClick, type = 'button', variant = 'primary', disabled, className = '',
}: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit';
  variant?: 'primary' | 'ghost' | 'danger'; disabled?: boolean; className?: string;
}) {
  const base = 'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-500',
    ghost: 'border border-slate-600 text-slate-300 hover:bg-slate-700',
    danger: 'bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    draft:    'bg-slate-600/50 text-slate-300 border border-slate-500/30',
    waiting:  'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
    ready:    'bg-blue-500/10 text-blue-400 border border-blue-500/30',
    done:     'bg-green-500/10 text-green-400 border border-green-500/30',
    canceled: 'bg-red-500/10 text-red-400 border border-red-500/30',
  };
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${map[status] ?? 'bg-slate-600 text-slate-200'}`}>
      {status}
    </span>
  );
}

export function ApiErr({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">{msg}</div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg bg-slate-800 border border-slate-700 rounded-xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-700 shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">×</button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}

export function Table({ heads, children }: { heads: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-700">
      <table className="w-full text-sm text-slate-300">
        <thead className="bg-slate-700/50 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            {heads.map((h) => (
              <th key={h} className="px-4 py-3 text-left font-medium">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/50">{children}</tbody>
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
      <td colSpan={cols} className="px-4 py-8 text-center text-slate-500">{msg}</td>
    </tr>
  );
}

export const STATUSES = ['draft', 'waiting', 'ready', 'done', 'canceled'] as const;
export type DocStatus = typeof STATUSES[number];

export function StatusSelect({
  status,
  onChange,
  disabled,
}: {
  status: DocStatus;
  onChange: (next: DocStatus) => void;
  disabled?: boolean;
}) {
  const colors: Record<DocStatus, string> = {
    draft:    'text-slate-300',
    waiting:  'text-yellow-400',
    ready:    'text-blue-400',
    done:     'text-green-400',
    canceled: 'text-red-400',
  };

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as DocStatus;
    if (next === status) return;

    if (next === 'done') {
      if (!window.confirm('Transitioning to Done will update stock levels. Continue?')) return;
    } else if (next === 'canceled') {
      if (!window.confirm('Mark this record as Canceled?')) return;
    }

    onChange(next);
  }

  return (
    <select
      value={status}
      onChange={handleChange}
      disabled={disabled || status === 'done' || status === 'canceled'}
      className={`rounded-lg border border-slate-600 bg-slate-800 px-2 py-1 text-xs font-medium outline-none
        focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition
        ${colors[status]}`}
    >
      {STATUSES.map((s) => (
        // Prevent going back to draft once done
        <option key={s} value={s} disabled={s === 'draft' && (status === 'done' || status === 'waiting' || status === 'ready' || status === 'canceled')}>
          {s.charAt(0).toUpperCase() + s.slice(1)}
        </option>
      ))}
    </select>
  );
}
