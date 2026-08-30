import { useEffect, useState } from 'react';
import { api, getApiError } from '../../lib/api';
import type { AuthSession, University } from '../../types';

const fieldClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-700 focus:bg-white focus:ring-4 focus:ring-emerald-100 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden';

type PasswordFieldProps = {
  label: string;
  value: string;
  visible: boolean;
  onChange: (value: string) => void;
  onBlur: () => void;
  onToggle: () => void;
  autoComplete: 'current-password' | 'new-password';
  placeholder?: string;
  required?: boolean;
  error?: string;
};

function PasswordField({ label, value, visible, onChange, onBlur, onToggle, autoComplete, placeholder, required, error }: PasswordFieldProps) {
  return <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">{label}
    <span className="relative block">
      <input required={required} type={visible ? 'text' : 'password'} maxLength={128} autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} onBlur={onBlur} className={fieldClass} />
      <button type="button" onClick={onToggle} aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`} className="absolute right-3 top-1/2 mt-1 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-[#02382c] focus:outline-none focus:ring-4 focus:ring-emerald-100">
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{visible && <path d="m4 4 16 16"/>}</svg>
      </button>
    </span>
    {error && <span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">{error}</span>}
  </label>;
}

const roleLabels: Record<AuthSession['role'], string> = {
  Ministry: 'Ministry Officer',
  University: 'University Registrar',
  SUPER_ADMIN: 'Super Administrator',
  UNIVERSITY_ADMIN: 'University Administrator',
};

export default function AccountSettings({ session }: { session: AuthSession }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibility, setVisibility] = useState({ current: false, next: false, confirm: false });
  const [touched, setTouched] = useState({ current: false, next: false, confirm: false });
  const [institution, setInstitution] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!session.universityId) return;
    let mounted = true;
    void api.get<University[]>('/api/universities').then(response => {
      if (!mounted) return;
      const university = response.data.find(item => item.id === session.universityId);
      if (university) setInstitution(`${university.nameEnglish} (${university.code})`);
    }).catch(() => { if (mounted) setInstitution('Assigned university'); });
    return () => { mounted = false; };
  }, [session.universityId]);

  const currentMissing = currentPassword.trim().length === 0;
  const newPasswordTooShort = newPassword.length > 0 && newPassword.length < 8;
  const passwordsDoNotMatch = (newPassword.length > 0 || confirmPassword.length > 0) && newPassword !== confirmPassword;
  const canSubmit = !saving && !currentMissing && newPassword.length >= 8 && !passwordsDoNotMatch;
  const assignedInstitution = institution || (session.role === 'SUPER_ADMIN' || session.role === 'Ministry' ? 'Ministry of Higher Education' : 'Loading institution...');

  const updateField = (setter: (value: string) => void, value: string) => {
    setter(value); setError(''); setSuccess('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setTouched({ current: true, next: true, confirm: true });
    if (!canSubmit) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const { data } = await api.put<{ message: string }>('/api/account/password', { currentPassword, newPassword });
      setSuccess(data.message);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTouched({ current: false, next: false, confirm: false });
      setVisibility({ current: false, next: false, confirm: false });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(getApiError(requestError, 'Your password could not be updated.'));
    } finally { setSaving(false); }
  };

  return <section className="min-h-full bg-slate-100 px-4 pb-10 pt-px sm:px-6">
    <div className="mt-10 w-full max-w-xl mx-auto rounded-xl border-t-4 border-t-amber-500 bg-white p-8 shadow-md">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#02614d]">Personal profile</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Account settings</h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">Review your account identity and manage your password securely.</p>
      </header>

      <section aria-labelledby="identity-summary-title" className="mt-7 rounded-xl border border-slate-200 bg-slate-50/80 p-5">
        <h2 id="identity-summary-title" className="text-sm font-bold text-slate-900">User identity summary</h2>
        <dl className="mt-4 grid gap-4 sm:grid-cols-2">
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Full name</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{session.displayName}</dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Email address</dt><dd className="mt-1 break-all text-sm font-semibold text-slate-800">{session.username}</dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Role</dt><dd className="mt-1"><span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-[#02382c]">{roleLabels[session.role]}</span></dd></div>
          <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Assigned institution</dt><dd className="mt-1 text-sm font-semibold text-slate-800">{assignedInstitution}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="password-title" className="mt-8 border-t border-slate-200 pt-7">
        <h2 id="password-title" className="text-lg font-bold text-slate-900">Security and password</h2>
        <p className="mt-1 text-sm text-slate-500">Enter your current password to authorize the change.</p>

        {success && <p role="status" aria-live="polite" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">{success}</p>}
        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">{error}</p>}

        <form onSubmit={submit} className="mt-6 space-y-6">
          <PasswordField label="Current password" required value={currentPassword} visible={visibility.current} autoComplete="current-password" onChange={value => updateField(setCurrentPassword, value)} onBlur={() => setTouched(current => ({ ...current, current: true }))} onToggle={() => setVisibility(current => ({ ...current, current: !current.current }))} error={touched.current && currentMissing ? 'Current password is required.' : undefined} />
          <PasswordField label="New password (optional)" value={newPassword} visible={visibility.next} autoComplete="new-password" placeholder="At least 8 characters" onChange={value => updateField(setNewPassword, value)} onBlur={() => setTouched(current => ({ ...current, next: true }))} onToggle={() => setVisibility(current => ({ ...current, next: !current.next }))} error={touched.next && newPasswordTooShort ? 'New password must contain at least 8 characters.' : undefined} />
          <PasswordField label="Confirm new password" value={confirmPassword} visible={visibility.confirm} autoComplete="new-password" placeholder="Repeat new password" onChange={value => updateField(setConfirmPassword, value)} onBlur={() => setTouched(current => ({ ...current, confirm: true }))} onToggle={() => setVisibility(current => ({ ...current, confirm: !current.confirm }))} error={touched.confirm && passwordsDoNotMatch ? 'Passwords do not match.' : undefined} />

          <footer className="mt-8 flex justify-end border-t border-slate-100 pt-6">
            <button type="submit" disabled={!canSubmit} className="rounded-xl bg-[#02382c] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#034d3d] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Updating password...' : 'Update password'}</button>
          </footer>
        </form>
      </section>
    </div>
  </section>;
}
