import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiError } from './lib/api';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (value: string) => {
    const normalized = value.trim();
    if (!normalized) return 'Institutional email is required.';
    return emailPattern.test(normalized) ? '' : 'Enter a valid institutional email address.';
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateEmail(email);
    setEmailError(validationError);
    setNotice('');
    setError('');
    if (validationError) return;
    setLoading(true);
    try {
      const { data } = await api.post<{ message: string }>('/api/auth/forgot-password', { email:email.trim() });
      setNotice(data.message);
    } catch (requestError) {
      setError(getApiError(requestError, 'The password recovery request could not be processed. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return <section className="relative isolate flex min-h-[calc(100vh-4.5rem)] items-center justify-center overflow-hidden px-4 py-10">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_38%),radial-gradient(circle_at_bottom_right,#e2e8f0,transparent_40%)]" />
    <div className="w-full max-w-md rounded-3xl border border-white bg-white p-8 shadow-2xl shadow-emerald-950/10">
      <Link to="/login" className="text-sm font-semibold text-emerald-700">&larr; Return to sign in</Link>
      <div className="mx-auto mt-8 grid h-20 w-20 place-items-center rounded-2xl bg-emerald-50 text-emerald-800">
        <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>
      </div>
      <h1 className="mt-5 text-center text-3xl font-black tracking-tight text-slate-900">Forgot your password?</h1>
      <p className="mt-2 text-center text-sm leading-6 text-slate-500">Enter your institutional email address to begin account recovery.</p>
      <form noValidate onSubmit={submit} className="mt-8 w-full space-y-5">
        <label htmlFor="recovery-email" className="block text-sm font-bold text-slate-700">Email Address</label>
        <div className="-mt-3">
          <input id="recovery-email" required type="email" autoComplete="email" spellCheck={false} value={email}
            onChange={event => { const value=event.target.value;setEmail(value);setNotice('');setError('');if(emailError)setEmailError(validateEmail(value)); }}
            onBlur={() => setEmailError(validateEmail(email))} aria-invalid={Boolean(emailError)}
            aria-describedby={emailError?'recovery-email-error':undefined}
            className={`w-full rounded-xl border bg-slate-50 px-4 py-3.5 outline-none transition focus:bg-white focus:ring-4 ${emailError?'border-red-500 focus:border-red-500 focus:ring-red-100':'border-slate-200 focus:border-emerald-600 focus:ring-emerald-100'}`} />
          {emailError&&<span id="recovery-email-error" role="alert" className="mt-2 block text-xs font-semibold text-red-600">{emailError}</span>}
        </div>
        {notice&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-800">{notice}</p>}
        {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{loading?'Sending secure link…':'Continue'}</button>
      </form>
    </div>
  </section>;
}
