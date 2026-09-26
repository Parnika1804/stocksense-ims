import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../context/AuthContext';
import { apiFetch, ApiError } from '../lib/api';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

type Fields = z.infer<typeof schema>;
type FieldErrors = Partial<Record<keyof Fields, string>>;

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)?.message;

  const [fields, setFields] = useState<Fields>({ email: '', password: '' });
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
      for (const issue of parsed.error.issues) {
        errs[issue.path[0] as keyof Fields] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    setLoading(true);
    try {
      const data = await apiFetch<{ token: string; user: { id: number; email: string; name: string; role: string } }>(
        '/auth/login',
        { method: 'POST', body: JSON.stringify(parsed.data) },
      );
      login(data.token, data.user);
      navigate('/');
    } catch (err) {
      setApiError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">📊</span>
          <h1 className="mt-2 text-2xl font-bold text-white">StockSense</h1>
          <p className="text-slate-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="bg-slate-800 rounded-xl p-6 flex flex-col gap-5 border border-slate-700">
          {successMessage && (
            <div className="rounded-lg bg-green-500/10 border border-green-500/30 px-3 py-2 text-sm text-green-400">
              {successMessage}
            </div>
          )}

          {apiError && (
            <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
              {apiError}
            </div>
          )}

          <Field label="Email" error={fieldErrors.email}>
            <input
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={(e) => set('email', e.target.value)}
              className={inputClass(!!fieldErrors.email)}
              placeholder="you@example.com"
            />
          </Field>

          <Field label="Password" error={fieldErrors.password}>
            <input
              type="password"
              autoComplete="current-password"
              value={fields.password}
              onChange={(e) => set('password', e.target.value)}
              className={inputClass(!!fieldErrors.password)}
              placeholder="••••••••"
            />
          </Field>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          <div className="flex items-center justify-between text-sm text-slate-400">
            <span>
              No account?{' '}
              <Link to="/signup" className="text-blue-400 hover:text-blue-300 font-medium">
                Sign up
              </Link>
            </span>
            <Link to="/forgot-password" className="text-blue-400 hover:text-blue-300 font-medium">
              Forgot password?
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function inputClass(hasError: boolean) {
  return `w-full rounded-lg border bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition ${
    hasError
      ? 'border-red-500 focus:ring-red-500/40'
      : 'border-slate-600 focus:ring-blue-500/40 focus:border-blue-500'
  }`;
}
