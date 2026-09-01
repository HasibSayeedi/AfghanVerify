import { useEffect, useMemo, useState } from 'react';
import { UsersRound } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { api, getApiError, readSession } from '../../lib/api';
import type { AuthSession, University } from '../../types';

type StaffRole = 'MINISTRY_ADMIN' | 'UNIVERSITY_ADMIN' | 'UNIVERSITY_REGISTRAR';

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: StaffRole;
  universityId?: string;
  assignedUniversity?: string;
  isActive: boolean;
}

interface NewUserForm {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  role: StaffRole;
  universityId: string;
}

const emptyForm: NewUserForm = {
  fullName: '', email: '', password: '', confirmPassword: '', role: 'MINISTRY_ADMIN', universityId: '',
};

const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100';

function UserIcon() {
  return <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M15 19a6 6 0 0 0-12 0"/><circle cx="9" cy="7" r="4"/><path d="M19 8v6m3-3h-6"/></svg>;
}

export default function SuperAdminUsers() {
  const session = readSession();
  if (session?.role !== 'SUPER_ADMIN' && session?.role !== 'UNIVERSITY_ADMIN') return <Navigate to="/login" replace />;
  return <SuperAdminUsersDashboard session={session} />;
}

function SuperAdminUsersDashboard({ session }: { session: AuthSession }) {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [universities, setUniversities] = useState<University[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [form, setForm] = useState<NewUserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState({ newPassword: false, confirmPassword: false });
  const [saveAttempted, setSaveAttempted] = useState(false);
  const [changingUserId, setChangingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<StaffUser | null>(null);

  const passwordTooShort = Boolean(editingUser && form.password.length > 0 && form.password.length < 8);
  const passwordsDoNotMatch = Boolean(editingUser && (form.password || form.confirmPassword) && form.password !== form.confirmPassword);
  const showPasswordLengthError = passwordTooShort && (passwordTouched.newPassword || saveAttempted);
  const showPasswordMismatchError = passwordsDoNotMatch && (passwordTouched.confirmPassword || saveAttempted);
  const isUniversityAdmin = session.role === 'UNIVERSITY_ADMIN';
  const visibleUsers = useMemo(() => {
    const currentEmail = session.username.trim().toLowerCase();
    return users.filter(user =>
      user.id !== session.userId && user.email.trim().toLowerCase() !== currentEmail
    );
  }, [session.userId, session.username, users]);
  const activeCount = useMemo(() => visibleUsers.filter(user => user.isActive).length, [visibleUsers]);
  const availableUniversities = isUniversityAdmin
    ? universities.filter(university => university.id === session.universityId)
    : universities;

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [usersResponse, universitiesResponse] = await Promise.all([
          api.get<StaffUser[]>('/api/admin/users'),
          api.get<University[]>('/api/universities'),
        ]);
        if (!mounted) return;
        setUsers(usersResponse.data);
        setUniversities(universitiesResponse.data);
      } catch (requestError) {
        if (mounted) setError(getApiError(requestError, 'User management data could not be loaded.'));
      } finally {
        if (mounted) setLoading(false);
      }
    };
    void loadData();
    return () => { mounted = false; };
  }, []);

  const closeModal = () => {
    if (saving) return;
    setIsModalOpen(false); setEditingUser(null); setForm(emptyForm); setShowPassword(false);
    setPasswordTouched({ newPassword: false, confirmPassword: false }); setSaveAttempted(false); setError('');
  };

  const openEdit = (user: StaffUser) => {
    setError(''); setSuccess('');
    setEditingUser(user);
    setForm({
      fullName: user.name,
      email: user.email,
      password: '',
      confirmPassword: '',
      role: user.role,
      universityId: user.universityId ?? '',
    });
    setShowPassword(false);
    setPasswordTouched({ newPassword: false, confirmPassword: false }); setSaveAttempted(false);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setError(''); setSuccess(''); setEditingUser(null);
    setForm({
      ...emptyForm,
      role: isUniversityAdmin ? 'UNIVERSITY_REGISTRAR' : 'MINISTRY_ADMIN',
      universityId: isUniversityAdmin ? session.universityId ?? '' : '',
    });
    setShowPassword(false);
    setPasswordTouched({ newPassword: false, confirmPassword: false }); setSaveAttempted(false);
    setIsModalOpen(true);
  };

  const saveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (editingUser) setSaveAttempted(true);
    if (passwordTooShort || passwordsDoNotMatch) return;
    setSaving(true); setError(''); setSuccess('');
    try {
      const commonPayload = {
        fullName: form.fullName.trim(), email: form.email.trim(),
        role: form.role,
        universityId: form.role === 'MINISTRY_ADMIN' ? null : isUniversityAdmin ? session.universityId : form.universityId,
      };
      if (editingUser) {
        const updatePayload = form.password ? { ...commonPayload, password: form.password } : commonPayload;
        const { data } = await api.put<StaffUser>(`/api/admin/users/${editingUser.id}`, updatePayload);
        setUsers(current => current.map(item => item.id === data.id ? data : item).sort((left, right) => left.name.localeCompare(right.name)));
      } else {
        const { data } = await api.post<StaffUser>('/api/admin/users', { ...commonPayload, password: form.password });
        setUsers(current => [...current, data].sort((left, right) => left.name.localeCompare(right.name)));
      }
      setEditingUser(null); setForm(emptyForm); setIsModalOpen(false);
    } catch (requestError) {
      setError(getApiError(requestError, `The staff account could not be ${editingUser ? 'updated' : 'created'}.`));
    } finally { setSaving(false); }
  };

  const toggleStatus = async (user: StaffUser) => {
    setChangingUserId(user.id); setError(''); setSuccess('');
    try {
      const { data } = await api.put<StaffUser>(`/api/admin/users/${user.id}/status`, { isActive: !user.isActive });
      setUsers(current => current.map(item => item.id === data.id ? data : item));
    } catch (requestError) {
      setError(getApiError(requestError, 'The account status could not be changed.'));
    } finally { setChangingUserId(null); }
  };

  const deleteUser = async (user: StaffUser) => {
    setDeletingUserId(user.id); setError(''); setSuccess('');
    try {
      if (!user.id) throw new Error('A valid staff account ID is required.');
      await api.patch(`/api/admin/users/${encodeURIComponent(user.id)}/delete`);
      setUsers(current => current.filter(item => item.id !== user.id));
      setError('');
      setSuccess('The staff account has been successfully deleted.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(getApiError(requestError, 'The staff account could not be deleted.'));
    } finally {
      setDeletingUserId(null);
      setPendingDeleteUser(null);
    }
  };

  const closeDeleteModal = () => {
    if (deletingUserId) return;
    setPendingDeleteUser(null);
  };

  const openDeleteModal = (user: StaffUser) => {
    setError(''); setSuccess('');
    setPendingDeleteUser(user);
  };

  return <section className="min-h-[calc(100vh-4.5rem)] bg-slate-100 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
    <div className="mx-auto w-full max-w-7xl rounded-xl bg-white p-6 shadow-md md:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#02382c] shadow-sm" aria-hidden="true">
            <UsersRound className="h-8 w-8" strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[.24em] text-emerald-700">{isUniversityAdmin ? 'University administration' : 'Platform administration'}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">User management</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{isUniversityAdmin ? 'Manage staff accounts securely within your assigned university.' : 'Provision Ministry administrators, university administrators, and registrars across the national platform.'}</p>
          </div>
        </div>
        <button type="button" onClick={openCreate} className="mr-0 inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#02382c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-[#034d3d] sm:ml-auto sm:self-end">
          <UserIcon /> Add new user
        </button>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Staff accounts</p><p className="mt-2 text-3xl font-black text-slate-900">{visibleUsers.length}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</p><p className="mt-2 text-3xl font-black text-emerald-700">{activeCount}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-400">Inactive</p><p className="mt-2 text-3xl font-black text-slate-500">{visibleUsers.length - activeCount}</p></div>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      {success && <p role="status" aria-live="polite" className="mt-6 mb-4 rounded-lg border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">{success}</p>}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500">
              <tr><th className="px-6 py-4">Name</th><th className="px-6 py-4">Email</th><th className="min-w-[160px] whitespace-nowrap px-6 py-4">Role</th><th className="px-6 py-4">Assigned university</th><th className="px-6 py-4">Status</th><th className="px-6 py-4 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading && <tr><td colSpan={6} className="px-6 py-14 text-center text-slate-500">Loading staff accounts...</td></tr>}
              {!loading && visibleUsers.length === 0 && <tr><td colSpan={6} className="px-6 py-14 text-center text-slate-500">No Ministry or university staff accounts have been created.</td></tr>}
              {!loading && visibleUsers.map(user => <tr key={user.id} className="transition hover:bg-slate-50/70">
                <td className="px-6 py-4 font-bold text-slate-900">{user.name}</td>
                <td className="px-6 py-4 text-slate-600">{user.email}</td>
                <td className="min-w-[160px] whitespace-nowrap px-6 py-4"><span className="inline-flex whitespace-nowrap rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">{user.role === 'MINISTRY_ADMIN' ? 'Ministry' : user.role === 'UNIVERSITY_ADMIN' ? 'University Admin' : 'University Registrar'}</span></td>
                <td className="px-6 py-4 text-slate-600">{user.assignedUniversity || <span className="text-slate-400">Not applicable</span>}</td>
                <td className="px-6 py-4"><span className={`inline-flex items-center gap-2 text-xs font-bold ${user.isActive ? 'text-emerald-700' : 'text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${user.isActive ? 'bg-emerald-500' : 'bg-slate-300'}`} />{user.isActive ? 'Active' : 'Inactive'}</span></td>
                <td className="px-6 py-4 align-middle">
                  <div className="flex items-center justify-end gap-4">
                    <button type="button" onClick={() => openEdit(user)} disabled={saving || deletingUserId === user.id} aria-label={`Edit ${user.name}`} title="Edit user" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-emerald-50 hover:text-[#02614d] focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-40">
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg>
                    </button>
                    <button type="button" onClick={() => openDeleteModal(user)} disabled={(isUniversityAdmin && user.email.toLowerCase() === session.username.toLowerCase()) || deletingUserId === user.id || changingUserId === user.id} aria-label={`Delete ${user.name}`} title={isUniversityAdmin && user.email.toLowerCase() === session.username.toLowerCase() ? 'You cannot delete your own administrator account' : 'Delete user'} className="grid h-9 w-9 place-items-center rounded-lg text-red-400 transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-40">
                      <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6"/><path d="M10 11v5m4-5v5"/></svg>
                    </button>
                    <button type="button" role="switch" aria-checked={user.isActive} aria-label={`${user.isActive ? 'Deactivate' : 'Activate'} ${user.name}`} disabled={(isUniversityAdmin && user.email.toLowerCase() === session.username.toLowerCase()) || changingUserId === user.id} onClick={() => void toggleStatus(user)} className={`relative inline-flex h-7 w-12 items-center rounded-full border transition focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${user.isActive ? 'border-[#02382c] bg-[#02382c]' : 'border-slate-300 bg-slate-200'}`}>
                      <span className={`h-5 w-5 rounded-full border border-slate-200 bg-white shadow-sm transition-transform ${user.isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    {isModalOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) closeModal(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="new-user-title" className="max-h-[85vh] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-3xl border border-white/60 border-t-4 border-t-amber-500 bg-white px-6 pt-6 pb-12 shadow-2xl sm:px-8 sm:pt-8 sm:pb-12">
        <div className="mx-auto w-full max-w-xl">
          <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-[#02614d]">Staff access</p><h2 id="new-user-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{editingUser ? 'Edit user' : 'Add new user'}</h2><p className="mt-1 text-sm text-slate-500">{editingUser ? 'Update this staff member’s identity and institutional access.' : 'Create an account with the minimum institutional access required.'}</p></div><button type="button" onClick={closeModal} aria-label="Close dialog" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-xl text-slate-500 hover:bg-slate-200">&times;</button></div>
        </div>
        <form onSubmit={saveUser} className="mx-auto mt-7 grid w-full max-w-xl gap-5 pb-6">
          {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Full name<input required maxLength={150} autoFocus placeholder="e.g., Ahmad Wali" value={form.fullName} onChange={event => setForm(current => ({ ...current, fullName: event.target.value }))} className={inputClass} /></label>
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Email<input required type="email" autoComplete="email" placeholder="staff@institution.edu.af" value={form.email} onChange={event => setForm(current => ({ ...current, email: event.target.value }))} className={inputClass} /></label>
          {!editingUser && <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Temporary password<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} className={inputClass} /><span className="mt-2 block text-xs font-medium normal-case tracking-normal text-slate-400">Identity password policies are also enforced by the server.</span></label>}
          {editingUser && <div className="grid gap-5 sm:grid-cols-2">
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">New password <span className="font-medium normal-case tracking-normal text-slate-400">(optional)</span><span className="relative block"><input type={showPassword ? 'text' : 'password'} maxLength={128} autoComplete="new-password" placeholder="At least 8 characters" value={form.password} onChange={event => setForm(current => ({ ...current, password: event.target.value }))} onBlur={() => setPasswordTouched(current => ({ ...current, newPassword: true }))} className={`${inputClass} pr-12 [&::-ms-clear]:hidden [&::-ms-reveal]:hidden`} /><button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? 'Hide new password' : 'Show new password'} className="absolute right-3 top-1/2 mt-1 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-emerald-700"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword && <path d="m4 4 16 16"/>}</svg></button></span>{showPasswordLengthError && <span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">New password must contain at least 8 characters.</span>}</label>
            <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Confirm new password<input type={showPassword ? 'text' : 'password'} maxLength={128} autoComplete="new-password" placeholder="Repeat new password" value={form.confirmPassword} onChange={event => setForm(current => ({ ...current, confirmPassword: event.target.value }))} onBlur={() => setPasswordTouched(current => ({ ...current, confirmPassword: true }))} className={`${inputClass} [&::-ms-clear]:hidden [&::-ms-reveal]:hidden`} />{showPasswordMismatchError && <span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-600">Passwords do not match.</span>}</label>
          </div>}
          <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Role<select required disabled={isUniversityAdmin} value={form.role} onChange={event => setForm(current => ({ ...current, role: event.target.value as StaffRole, universityId: '' }))} className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}>
            {isUniversityAdmin ? <option value={form.role}>{form.role === 'UNIVERSITY_ADMIN' ? 'University administrator' : 'University registrar'}</option> : <><option value="MINISTRY_ADMIN">Ministry administrator</option><option value="UNIVERSITY_ADMIN">University administrator</option><option value="UNIVERSITY_REGISTRAR">University registrar</option></>}
          </select>{isUniversityAdmin && !editingUser && <span className="mt-2 block text-xs font-medium normal-case tracking-normal text-slate-400">University administrators can provision registrar accounts.</span>}</label>
          {form.role !== 'MINISTRY_ADMIN' && <label className="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Assigned university<select required disabled={isUniversityAdmin} value={form.universityId} onChange={event => setForm(current => ({ ...current, universityId: event.target.value }))} className={`${inputClass} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}><option value="" disabled selected hidden>Select a registered university</option>{availableUniversities.map(university => <option key={university.id} value={university.id}>{university.nameEnglish} ({university.code})</option>)}</select>{isUniversityAdmin && <span className="mt-2 block text-xs font-medium normal-case tracking-normal text-slate-400">Locked to your assigned institution.</span>}</label>}
          <div className="mt-6 flex flex-col-reverse items-stretch gap-3 pt-2 sm:flex-row sm:items-center sm:justify-end"><button type="button" onClick={closeModal} disabled={saving} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || showPasswordLengthError || showPasswordMismatchError || (form.role !== 'MINISTRY_ADMIN' && !form.universityId)} className="rounded-xl bg-[#02382c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/10 hover:bg-[#034d3d] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving account...' : editingUser ? 'Save changes' : 'Create staff account'}</button></div>
        </form>
      </div>
    </div>}

    {pendingDeleteUser && <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-black/50 px-4 py-8 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) closeDeleteModal(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="delete-user-title" aria-describedby="delete-user-description" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-red-100 text-red-600">
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></svg>
        </div>
        <h2 id="delete-user-title" className="mt-5 text-xl font-bold text-slate-900">Delete Staff Account?</h2>
        <p id="delete-user-description" className="mt-2 text-sm leading-6 text-slate-600">Are you sure you want to permanently delete the staff account for <span className="font-semibold text-slate-900">{pendingDeleteUser.name}</span>? This action is destructive and cannot be undone.</p>
        <div className="mt-7 flex items-center justify-end gap-3">
          <button type="button" onClick={closeDeleteModal} disabled={Boolean(deletingUserId)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-4 focus:ring-slate-100 disabled:cursor-not-allowed disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => void deleteUser(pendingDeleteUser)} disabled={Boolean(deletingUserId)} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-wait disabled:opacity-60">{deletingUserId ? 'Deleting...' : 'Yes, Delete'}</button>
        </div>
      </div>
    </div>}
  </section>;
}
