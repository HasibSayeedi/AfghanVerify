import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, getApiError } from './lib/api';

const passwordError = (value: string) => !value
  ? 'New password is required.'
  : value.length < 8 ? 'New password must contain at least 8 characters.' : '';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email')?.trim() ?? '';
  const token = searchParams.get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({ password:'', confirm:'' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const linkIsPresent = Boolean(email && token);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = {
      password:passwordError(newPassword),
      confirm:!confirmPassword?'Confirm your new password.':confirmPassword!==newPassword?'Passwords do not match.':''
    };
    setErrors(nextErrors);setError('');setSuccess('');
    if (!linkIsPresent) { setError('This password recovery link is incomplete. Request a new link and try again.'); return; }
    if (nextErrors.password || nextErrors.confirm) return;
    setLoading(true);
    try {
      const {data}=await api.post<{message:string}>('/api/auth/reset-password',{email,token,newPassword});
      setSuccess(data.message);setNewPassword('');setConfirmPassword('');
    } catch(requestError){setError(getApiError(requestError,'The password could not be reset. Request a new recovery link and try again.'));}
    finally{setLoading(false);}
  };

  const inputClass=(hasError:boolean)=>`w-full rounded-xl border bg-slate-50 px-4 py-3.5 pr-16 outline-none transition focus:bg-white focus:ring-4 ${hasError?'border-red-500 focus:border-red-500 focus:ring-red-100':'border-slate-200 focus:border-emerald-600 focus:ring-emerald-100'}`;
  return <section className="relative isolate flex min-h-[calc(100vh-4.5rem)] items-center justify-center overflow-hidden px-4 py-10">
    <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,#d1fae5,transparent_38%),radial-gradient(circle_at_bottom_right,#e2e8f0,transparent_40%)]" />
    <div className="w-full max-w-md rounded-3xl border border-white bg-white p-8 shadow-2xl shadow-emerald-950/10">
      <Link to="/login" className="text-sm font-semibold text-emerald-700">&larr; Return to sign in</Link>
      <div className="mx-auto mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg></div>
      <h1 className="mt-5 text-center text-3xl font-black tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-2 text-center text-sm leading-6 text-slate-500">Create a strong password for your institutional account.</p>
      <form noValidate onSubmit={submit} className="mt-8 space-y-5">
        <div><label htmlFor="new-password" className="block text-sm font-bold text-slate-700">New Password</label><div className="relative mt-2"><input id="new-password" type={showPassword?'text':'password'} autoComplete="new-password" value={newPassword} onChange={event=>{const value=event.target.value;setNewPassword(value);if(errors.password)setErrors(current=>({...current,password:passwordError(value)}));}} onBlur={()=>setErrors(current=>({...current,password:passwordError(newPassword)}))} aria-invalid={Boolean(errors.password)} className={inputClass(Boolean(errors.password))}/><button type="button" onClick={()=>setShowPassword(value=>!value)} className="absolute inset-y-0 right-0 px-4 text-xs font-bold text-slate-500 hover:text-emerald-700">{showPassword?'Hide':'Show'}</button></div>{errors.password&&<p role="alert" className="mt-2 text-xs font-semibold text-red-600">{errors.password}</p>}</div>
        <div><label htmlFor="confirm-password" className="block text-sm font-bold text-slate-700">Confirm New Password</label><input id="confirm-password" type={showPassword?'text':'password'} autoComplete="new-password" value={confirmPassword} onChange={event=>{const value=event.target.value;setConfirmPassword(value);if(errors.confirm)setErrors(current=>({...current,confirm:value===newPassword?'':'Passwords do not match.'}));}} onBlur={()=>setErrors(current=>({...current,confirm:!confirmPassword?'Confirm your new password.':confirmPassword===newPassword?'':'Passwords do not match.'}))} aria-invalid={Boolean(errors.confirm)} className={`mt-2 ${inputClass(Boolean(errors.confirm))}`}/>{errors.confirm&&<p role="alert" className="mt-2 text-xs font-semibold text-red-600">{errors.confirm}</p>}</div>
        {success&&<p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium leading-6 text-emerald-800">{success} <Link to="/login" className="font-bold underline">Sign in now</Link></p>}
        {error&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm font-medium leading-6 text-red-700">{error}</p>}
        <button type="submit" disabled={loading||Boolean(success)} className="w-full rounded-xl bg-emerald-700 px-4 py-3.5 font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60">{loading?'Updating password…':'Update password'}</button>
      </form>
    </div>
  </section>;
}
