import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { apiFetch, ApiError } from '../lib/api';

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

type ResetFields = z.infer<typeof resetSchema>;
type ResetErrors = Partial<Record<keyof ResetFields, string>>;

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

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);

  const [email, setEmailVal] = useState('');
  const [emailError, setEmailError] = useState('');
  const [apiErr1, setApiErr1] = useState('');
  const [loading1, setLoading1] = useState(false);
  const [demoOtp, setDemoOtp] = useState('');

  const [resetFields, setResetFields] = useState<ResetFields>({ otp: '', newPassword: '', confirm: '' });
  const [resetErrors, setResetErrors] = useState<ResetErrors>({});
  const [apiErr2, setApiErr2] = useState('');
  const [loading2, setLoading2] = useState(false);

  async function handleRequestOtp(e: React.FormEvent) {
    e.preventDefault();
    setApiErr1('');
    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) { setEmailError(parsed.error.issues[0].message); return; }
    setLoading1(true);
    try {
      const data = await apiFetch<{ otp: string | null; message: string }>(
        '/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) },
      );
      setDemoOtp(data.otp ?? '');
      setStep(2);
    } catch (err) {
      setApiErr1(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally { setLoading1(false); }
  }

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

  const submitBtn = (label: string, loading: boolean, loadingLabel: string) => (
    <button type="submit" disabled={loading}
      className="w-full mt-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white
        hover:bg-indigo-500 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed
        transition-all duration-150 shadow-sm shadow-indigo-900/40">
      {loading ? loadingLabel : label}
    </button>
  );

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
          <p className="text-sm text-slate-500 mt-1">
            {step === 1 ? 'Reset your password' : 'Enter your new password'}
          </p>
        </div>

        <div className="bg-[#161b27] border border-[#2a3347] rounded-2xl p-7 flex flex-col gap-5 shadow-xl shadow-black/30">

          {/* ── Step 1 ── */}
          {step === 1 && (
            <>
              {apiErr1 && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  {apiErr1}
                </div>
              )}
              <form onSubmit={handleRequestOtp} noValidate className="flex flex-col gap-4">
                <AuthField label="Email" error={emailError}>
                  <input type="email" autoComplete="email" value={email}
                    onChange={(e) => { setEmailVal(e.target.value); setEmailError(''); setApiErr1(''); }}
                    className={authInput(!!emailError)} placeholder="you@example.com" />
                </AuthField>
                {submitBtn('Send OTP', loading1, 'Sending…')}
              </form>
              <p className="text-center text-xs text-slate-600 pt-1">
                <Link to="/login" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
                  ← Back to sign in
                </Link>
              </p>
            </>
          )}

          {/* ── Step 2 ── */}
          {step === 2 && (
            <>
              {/* Demo OTP banner */}
              {demoOtp ? (
                <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-3.5 flex flex-col gap-1.5 animate-fade-in">
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">
                    Demo mode — OTP returned directly
                  </p>
                  <p className="text-3xl font-mono font-bold text-slate-100 tracking-[0.3em]">{demoOtp}</p>
                  <p className="text-xs text-slate-600">Valid for 10 minutes. Copy it into the field below.</p>
                </div>
              ) : (
                <div className="rounded-xl border border-[#2a3347] bg-[#1e2536] px-4 py-3 text-sm text-slate-500">
                  If that email is registered, an OTP would have been sent. Enter it below.
                </div>
              )}

              {apiErr2 && (
                <div className="flex items-center gap-2 rounded-xl bg-red-500/5 border border-red-500/20 px-4 py-2.5 text-sm text-red-400">
                  <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                  </svg>
                  {apiErr2}
                </div>
              )}

              <form onSubmit={handleReset} noValidate className="flex flex-col gap-4">
                <AuthField label="OTP code" error={resetErrors.otp}>
                  <input type="text" inputMode="numeric" maxLength={6}
                    value={resetFields.otp}
                    onChange={(e) => setReset('otp', e.target.value.replace(/\D/g, ''))}
                    className={authInput(!!resetErrors.otp)} placeholder="123456" />
                </AuthField>

                <AuthField label="New password" error={resetErrors.newPassword}>
                  <input type="password" autoComplete="new-password" value={resetFields.newPassword}
                    onChange={(e) => setReset('newPassword', e.target.value)}
                    className={authInput(!!resetErrors.newPassword)} placeholder="••••••••" />
                </AuthField>

                <AuthField label="Confirm password" error={resetErrors.confirm}>
                  <input type="password" autoComplete="new-password" value={resetFields.confirm}
                    onChange={(e) => setReset('confirm', e.target.value)}
                    className={authInput(!!resetErrors.confirm)} placeholder="••••••••" />
                </AuthField>

                {submitBtn('Reset Password', loading2, 'Resetting…')}
              </form>

              <button type="button" onClick={() => setStep(1)}
                className="text-center text-xs text-slate-600 hover:text-slate-300 transition-colors pt-1">
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
