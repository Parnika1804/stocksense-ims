import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';

// ── Schemas ────────────────────────────────────────────────────────
const emailSchema = z.object({
  email: z.string().email('Enter a valid email'),
});

const resetSchema = z.object({
  otp: z.string().length(6, 'OTP must be exactly 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
  confirm: z.string(),
}).refine((d) => d.newPassword === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});

type EmailFields = z.infer<typeof emailSchema>;
type ResetFields = z.infer<typeof resetSchema>;
type EmailErrors = Partial<Record<keyof EmailFields, string>>;
type ResetErrors = Partial<Record<keyof ResetFields, string>>;

function inputClass(hasError = false) {
  return `w-full rounded-lg border bg-slate-700 px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:ring-2 transition ${
    hasError ? 'border-red-500 focus:ring-red-500/40' : 'border-slate-600 focus:ring-blue-500/40 focus:border-blue-500'
  }`;
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

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1 state
  const [email, setEmailVal] = useState('');
  const [emailError, setEmailError] = useState('');
  const [apiErr1, setApiErr1] = useState('');
  const [loading1, setLoading1] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  // Step 2 state
  const [resetFields, setResetFields] = useState<ResetFields>({ otp: '', newPassword: '', confirm: '' });
  const [resetErrors, setResetErrors] = useState<ResetErrors>({});
  const [apiErr2, setApiErr2] = useState('');
  const [loading2, setLoading2] = useState(false);

  // ── Step 1: request OTP ────────────────────────────────────────
  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setApiErr1('');
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setEmailError(parsed.error.issues[0].message);
      return;
    }
    setLoading1(true);
    try {
      const data = await apiFetch<{ otp: string | null; message: string }>(
        '/auth/forgot-password',
        { method: 'POST', body: JSON.stringify({ email }) },
      );
      if (data.otp) {
        setDemoOtp(data.otp);
        setStep(2);
      } else {
        // Email not found — still advance to avoid enumeration, show generic message
        setDemoOtp('');
        setStep(2);
      }
    } catch (err) {
      setApiErr1(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setLoading1(false); }
  }

  // ── Step 2: reset password ─────────────────────────────────────
  function setReset(k: keyof ResetFields, v: string) {
    setResetFields((f) => ({ ...f, [k]: v }));
    setResetErrors((e) => ({ ...e, [k]: undefined }));
    setApiErr2('');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setApiErr2('');
    const parsed = resetSchema.safeParse(resetFields);
    if (!parsed.success) {
      const errs: ResetErrors = {};
      parsed.error.issues.forEach((i) => { errs[i.path[0] as keyof ResetFields] = i.message; });
      setResetErrors(errs);
      return;
    }
    setLoading2(true);
    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp: parsed.data.otp, newPassword: parsed.data.newPassword }),
      });
      navigate('/login', { state: { message: 'Password reset successfully. Please sign in.' } });
    } catch (err) {
      setApiErr2(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setLoading2(false); }
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-4xl">📊</span>
          <h1 className="mt-2 text-2xl font-bold text-white">StockSense</h1>
          <p className="text-slate-400 text-sm mt-1">
            {step === 1 ? 'Reset your password' : 'Enter your new password'}
          </p>
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} noValidate
            className="bg-slate-800 rounded-xl p-6 flex flex-col gap-5 border border-slate-700">
            {apiErr1 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
                {apiErr1}
              </div>
            )}
            <Field label="Email" error={emailError}>
              <input
                type="email" autoComplete="email"
                value={email}
                onChange={(e) => { setEmailVal(e.target.value); setEmailError(''); setApiErr1(''); }}
                className={inputClass(!!emailError)}
                placeholder="you@example.com"
              />
            </Field>
            <button type="submit" disabled={loading1}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading1 ? 'Sending…' : 'Send OTP'}
            </button>
            <p className="text-center text-sm text-slate-400">
              <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
                Back to sign in
              </Link>
            </p>
          </form>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <form onSubmit={handleReset} noValidate
            className="bg-slate-800 rounded-xl p-6 flex flex-col gap-5 border border-slate-700">

            {/* Demo OTP banner */}
            {demoOtp ? (
              <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-3 flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">
                  Demo mode — OTP returned directly
                </p>
                <p className="text-2xl font-mono font-bold text-white tracking-widest">{demoOtp}</p>
                <p className="text-xs text-slate-400">Valid for 10 minutes. Copy it into the field below.</p>
              </div>
            ) : (
              <div className="rounded-lg border border-slate-600 bg-slate-700/30 px-3 py-2 text-sm text-slate-400">
                If that email is registered, an OTP would have been sent. Enter it below.
              </div>
            )}

            {apiErr2 && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-400">
                {apiErr2}
              </div>
            )}

            <Field label="OTP code" error={resetErrors.otp}>
              <input
                type="text" inputMode="numeric" maxLength={6}
                value={resetFields.otp}
                onChange={(e) => setReset('otp', e.target.value.replace(/\D/g, ''))}
                className={inputClass(!!resetErrors.otp)}
                placeholder="123456"
              />
            </Field>
            <Field label="New password" error={resetErrors.newPassword}>
              <input
                type="password" autoComplete="new-password"
                value={resetFields.newPassword}
                onChange={(e) => setReset('newPassword', e.target.value)}
                className={inputClass(!!resetErrors.newPassword)}
                placeholder="••••••••"
              />
            </Field>
            <Field label="Confirm password" error={resetErrors.confirm}>
              <input
                type="password" autoComplete="new-password"
                value={resetFields.confirm}
                onChange={(e) => setReset('confirm', e.target.value)}
                className={inputClass(!!resetErrors.confirm)}
                placeholder="••••••••"
              />
            </Field>

            <button type="submit" disabled={loading2}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {loading2 ? 'Resetting…' : 'Reset Password'}
            </button>

            <button type="button" onClick={() => setStep(1)}
              className="text-center text-sm text-slate-400 hover:text-white transition-colors">
              ← Back
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
