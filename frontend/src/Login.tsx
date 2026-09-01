import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { api, getApiError, saveSession } from './lib/api';
import type { AuthSession } from './types';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const getEmailError = (value: string) => {
  const normalized = value.trim();
  if (!normalized) return 'Email is required to sign in';
  if (!emailPattern.test(normalized)) return 'Enter a valid email address';
  return '';
};

const getPasswordError = (value: string) => {
  if (!value) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  return '';
};

export default function Login({ onLogin }: { onLogin: (session: AuthSession) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextEmailError = getEmailError(email);
    const nextPasswordError = getPasswordError(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setError('');

    if (nextEmailError || nextPasswordError) return;

    setLoading(true);
    try {
      const { data } = await api.post<AuthSession>('/api/auth/login', { username: email.trim(), password });
      saveSession(data);
      onLogin(data);
      const requested = (location.state as { from?: string } | null)?.from;
      const dashboard = data.role === 'SUPER_ADMIN' || data.role === 'UNIVERSITY_ADMIN'
        ? '/admin/users'
        : data.role === 'Ministry' ? '/ministry' : '/university';
      navigate(requested || dashboard, { replace: true });
    } catch (err) {
      setError(getApiError(err, 'Invalid email or password.'));
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (hasError: boolean) => `mt-2 w-full rounded-xl border bg-slate-50 px-4 py-3.5 outline-none transition focus:bg-white focus:ring-4 ${
    hasError
      ? 'border-red-500 focus:border-red-500 focus:ring-red-100'
      : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-100'
  }`;

  return <section className="relative isolate min-h-[calc(100vh-4.5rem)] overflow-hidden px-4 py-16">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_38%),radial-gradient(circle_at_bottom_right,#e2e8f0,transparent_40%)]" />
    <div className="mx-auto grid max-w-5xl overflow-hidden rounded-3xl border border-white bg-white shadow-2xl shadow-emerald-950/10 lg:grid-cols-[1.05fr_.95fr]">
      <div className="hidden bg-emerald-950 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[.28em] text-emerald-300">Authorized personnel</p><h1 className="mt-6 text-4xl font-black leading-tight">Protecting the integrity of every academic achievement.</h1><p className="mt-5 max-w-md text-emerald-100/75">Secure access for accredited universities and Ministry of Higher Education reviewers.</p></div>
        <div className="flex items-center gap-3 text-sm text-emerald-100"><span className="h-2 w-2 rounded-full bg-emerald-400" />Identity protected by JWT and role-based access</div>
      </div>
      <div className="p-7 sm:p-12">
        <Link to="/" className="text-sm font-semibold text-emerald-700">&larr; Return to public verification</Link>
        <h2 className="mt-10 text-3xl font-black tracking-tight">Welcome back</h2>
        <p className="mt-2 text-sm text-slate-500">Sign in with your institutional account.</p>
        <form noValidate onSubmit={submit} className="mt-9 space-y-5">
          <label className="block text-sm font-bold text-slate-700">
            Email Address
            <input
              required
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={event => {
                const value = event.target.value;
                setEmail(value);
                if (emailError) setEmailError(getEmailError(value));
              }}
              onBlur={() => setEmailError(getEmailError(email))}
              aria-invalid={Boolean(emailError)}
              aria-describedby={emailError ? 'email-error' : undefined}
              className={inputClass(Boolean(emailError))}
            />
            {emailError && <span id="email-error" role="alert" className="mt-2 block text-xs font-semibold text-red-600">{emailError}</span>}
          </label>
          <div>
            <div className="flex items-center justify-between gap-4">
              <label htmlFor="login-password" className="text-sm font-bold text-slate-700">Password</label>
              <Link to="/forgot-password" className="text-xs font-medium text-slate-500 transition-colors hover:text-emerald-700">Forgot password?</Link>
            </div>
            <input
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={event => {
                const value = event.target.value;
                setPassword(value);
                if (passwordError) setPasswordError(getPasswordError(value));
              }}
              aria-invalid={Boolean(passwordError)}
              aria-describedby={passwordError ? 'password-error' : undefined}
              className={inputClass(Boolean(passwordError))}
            />
            {passwordError && <span id="password-error" role="alert" className="mt-2 block text-xs font-semibold text-red-600">{passwordError}</span>}
          </div>
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <button disabled={loading} className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:opacity-60">{loading ? 'Verifying identity...' : 'Secure sign in'}</button>
        </form>
      </div>
    </div>
  </section>;
}
