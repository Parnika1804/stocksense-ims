import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
  role: z.enum(['manager', 'staff']),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type Fields = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof Fields, string>>;

function AuthField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400 flex items-center gap-1">⚠ {error}</p>}
    </div>
  );
}

function authInput(hasError = false) {
  return [
    'w-full rounded-xl border px-4 py-2.5 text-sm text-slate-100 placeholder-slate-600',
    'bg-[#1e2536] outline-none transition-all duration-150 focus:ring-2',
    hasError
      ? 'border-red-500/60 focus:ring-red-500/20 focus:border-red-500'
      : 'border-[#2a3347] focus:ring-indigo-500/25 focus:border-indigo-500',
  ].join(' ');
}

export default function Signup() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [fields, setFields] = useState<Fields>({ name: '', email: '', password: '', confirm: '', role: 'staff' });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  function set(key: keyof Fields, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
    setApiError('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setApiError('');
    const parsed = schema.safeParse(fields);
    if (!parsed.success) {
      const errs: FieldErrors = {};
      for (const issue of parsed.error.issues) errs[issue.path[0] as keyof Fields] = issue.message;
      setFieldErrors(errs);
      return;
    }
    setLoading(true);
    try {
      const { name, email, password, role } = parsed.data;
      const data = await apiFetch<{ token: string; user: { id: number; email: string; name: string; role: 'manager' | 'staff' } }>(
        '/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password, role }) },
      );
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10" style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-indigo-600 shadow-lg shadow-indigo-900/40 mb-4">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M7 10.5h12M7 13h8M7 15.5h5" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M16 7l3 3.5-3 3.5" stroke="#a5b4fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-100 tracking-tight">StockSense</h1>
          <p className="text-sm text-slate-500 mt-1">Create your account</p>
        </div>

        <div className="bg-[#161b27] border border-[#2a3347] rounded-2xl p-7 flex flex-col gap-5 shadow-xl shadow-black/30">
          {apiError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
              <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              </svg>
              {apiError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
            <AuthField label="Name" error={fieldErrors.name}>
              <input type="text" autoComplete="name" value={fields.name}
                onChange={(e) => set('name', e.target.value)}
                className={authInput(!!fieldErrors.name)} placeholder="Jane Smith" />
            </AuthField>

            <AuthField label="Email" error={fieldErrors.email}>
              <input type="email" autoComplete="email" value={fields.email}
                onChange={(e) => set('email', e.target.value)}
                className={authInput(!!fieldErrors.email)} placeholder="you@example.com" />
            </AuthField>

            <AuthField label="Password" error={fieldErrors.password}>
              <input type="password" autoComplete="new-password" value={fields.password}
                onChange={(e) => set('password', e.target.value)}
                className={authInput(!!fieldErrors.password)} placeholder="••••••••" />
            </AuthField>

            <AuthField label="Confirm password" error={fieldErrors.confirm}>
              <input type="password" autoComplete="new-password" value={fields.confirm}
                onChange={(e) => set('confirm', e.target.value)}
                className={authInput(!!fieldErrors.confirm)} placeholder="••••••••" />
            </AuthField>

            <AuthField label="Account type">
              <div className="flex gap-3 pt-0.5">
                {([['staff', 'Warehouse Staff'], ['manager', 'Inventory Manager']] as const).map(([val, label]) => (
                  <label key={val}
                    className={`flex-1 flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm cursor-pointer transition-all duration-150
                      ${fields.role === val
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300'
                        : 'border-[#2a3347] text-slate-500 hover:border-slate-500 hover:text-slate-300'}`}>
                    <input type="radio" name="role" value={val} checked={fields.role === val}
                      onChange={() => set('role', val)} className="sr-only" />
                    {label}
                  </label>
                ))}
              </div>
            </AuthField>

            <button type="submit" disabled={loading}
              className="w-full mt-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
                hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed
                transition-all duration-150 shadow-sm shadow-indigo-900/40">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="text-center text-xs text-slate-600 pt-1">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
