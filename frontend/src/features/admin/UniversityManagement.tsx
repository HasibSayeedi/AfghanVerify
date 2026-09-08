import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Building2, ChevronDown, ChevronRight, Eye, GraduationCap, ImagePlus, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound, X, type LucideIcon } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { api, getApiError, readSession } from '../../lib/api';

interface ManagedUniversity {
  id: string;
  officialName: string;
  nameDari: string;
  namePashto: string;
  code: string;
  shortName: string;
  universityType: 'Public' | 'Private';
  province: string;
  city: string;
  campusBranch: string;
  officialAddress: string;
  officialEmail: string;
  officialPhoneNumber: string;
  website: string;
  logoUrl: string;
  isActive: boolean;
  userCount: number;
  studentCount: number;
  credentialCount: number;
  facultyCount: number;
  assignedAdminUserId?: string;
  assignedAdminName?: string;
  rowVersion: string;
}

interface AdministratorOption {
  id: string;
  name: string;
  email: string;
  universityId?: string;
  universityName?: string;
  isActive: boolean;
}

interface UniversityForm {
  officialName: string;
  nameDari: string;
  namePashto: string;
  code: string;
  shortName: string;
  universityType: 'Public' | 'Private';
  province: string;
  city: string;
  campusBranch: string;
  officialAddress: string;
  officialEmail: string;
  officialPhoneNumber: string;
  website: string;
  logoUrl: string;
  isActive: boolean;
  universityAdminUserId: string;
  rowVersion: string;
}

interface ManagedDepartment { id: string; name: string; isActive: boolean; studentCount: number; }
interface ManagedFaculty { id: string; name: string; isActive: boolean; studentCount: number; departments: ManagedDepartment[]; }
interface AcademicStructure { universityId: string; universityName: string; faculties: ManagedFaculty[]; }

type FormErrors = Partial<Record<keyof UniversityForm, string>>;

const emptyForm: UniversityForm = {
  officialName: '', nameDari: '', namePashto: '', code: '', shortName: '', universityType: 'Public',
  province: '', city: '', campusBranch: '', officialAddress: '', officialEmail: '', officialPhoneNumber: '',
  website: '', logoUrl: '', isActive: true, universityAdminUserId: '', rowVersion: '',
};

const isHttpUrl = (value: string) => {
  if (!value.trim()) return true;
  try { const url = new URL(value); return url.protocol === 'http:' || url.protocol === 'https:'; } catch { return false; }
};

const validate = (form: UniversityForm): FormErrors => {
  const errors: FormErrors = {};
  if (!form.officialName.trim()) errors.officialName = 'Official university name is required.';
  if (!/^[A-Za-z]{2,4}$/.test(form.code.trim())) errors.code = 'Use 2 to 4 letters for the unique university code.';
  if (!form.shortName.trim()) errors.shortName = 'Short name is required.';
  if (!form.province.trim()) errors.province = 'Province is required.';
  if (!form.city.trim()) errors.city = 'City is required.';
  if (!form.officialAddress.trim()) errors.officialAddress = 'Official address is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.officialEmail.trim())) errors.officialEmail = 'Enter a valid official email address.';
  if (!/^\+?[0-9][0-9 ()-]{6,30}$/.test(form.officialPhoneNumber.trim())) errors.officialPhoneNumber = 'Enter a valid official phone number.';
  if (!isHttpUrl(form.website)) errors.website = 'Website must be a valid HTTP or HTTPS URL.';
  if (form.logoUrl.trim() && !form.logoUrl.trim().startsWith('/') && !isHttpUrl(form.logoUrl)) errors.logoUrl = 'Logo must be an HTTP/HTTPS URL or application path.';
  return errors;
};

const fieldClass = (invalid: boolean) => `mt-2 w-full rounded-xl border bg-slate-50 px-3.5 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${invalid ? 'border-red-500 focus:border-red-500 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-100'}`;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="mt-1.5 text-xs font-medium text-red-600">{message}</p> : null;
}

function TableActionButton({ label, onClick, className, children }: {
  label: string;
  onClick: () => void;
  className: string;
  children: React.ReactNode;
}) {
  return <span className="group relative inline-flex">
    <button type="button" onClick={onClick} aria-label={label} className={`${className} focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-100`}>
      {children}
    </button>
    <span role="tooltip" className="pointer-events-none invisible absolute right-0 bottom-[calc(100%+0.5rem)] z-30 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-[11px] font-semibold tracking-normal text-white opacity-0 shadow-lg transition-all duration-150 group-hover:visible group-hover:-translate-y-0.5 group-hover:opacity-100 group-focus-within:visible group-focus-within:-translate-y-0.5 group-focus-within:opacity-100 group-active:visible group-active:opacity-100">
      {label}<span className="absolute top-full right-3 border-4 border-transparent border-t-slate-900" aria-hidden="true"/>
    </span>
  </span>;
}

export default function UniversityManagement() {
  const session = readSession();
  if (session?.role !== 'SUPER_ADMIN') return <Navigate to="/login" replace />;
  return <UniversityManagementDashboard />;
}

function UniversityManagementDashboard() {
  const [universities, setUniversities] = useState<ManagedUniversity[]>([]);
  const [administrators, setAdministrators] = useState<AdministratorOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [editing, setEditing] = useState<ManagedUniversity | null>(null);
  const [viewing, setViewing] = useState<ManagedUniversity | null>(null);
  const [structureUniversity, setStructureUniversity] = useState<ManagedUniversity | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<UniversityForm>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<keyof UniversityForm, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState('');
  const [removeLogo, setRemoveLogo] = useState(false);
  const [logoError, setLogoError] = useState('');
  const [logoInputKey, setLogoInputKey] = useState(0);
  const formDialogRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const logoBrowseScrollTop = useRef(0);

  useEffect(() => () => { if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview); }, [logoPreview]);
  useEffect(() => {
    if (!(formOpen || viewing || structureUniversity)) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previous; };
  }, [formOpen, viewing, structureUniversity]);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const [universityResponse, adminResponse] = await Promise.all([
          api.get<ManagedUniversity[]>('/api/admin/universities'),
          api.get<AdministratorOption[]>('/api/admin/universities/administrator-options'),
        ]);
        if (!mounted) return;
        setUniversities(universityResponse.data);
        setAdministrators(adminResponse.data);
      } catch (requestError) {
        if (mounted) setError(getApiError(requestError, 'University management data could not be loaded.'));
      } finally { if (mounted) setLoading(false); }
    };
    void loadData();
    return () => { mounted = false; };
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return universities.filter(item => {
      const matchesStatus = statusFilter === 'All' || (statusFilter === 'Active' ? item.isActive : !item.isActive);
      const matchesQuery = !query || [item.officialName, item.shortName, item.code, item.province, item.city]
        .some(value => value.toLowerCase().includes(query));
      return matchesStatus && matchesQuery;
    });
  }, [search, statusFilter, universities]);

  const stats = useMemo(() => ({
    total: universities.length,
    active: universities.filter(item => item.isActive).length,
    users: universities.reduce((sum, item) => sum + item.userCount, 0),
    students: universities.reduce((sum, item) => sum + item.studentCount, 0),
  }), [universities]);
  const statisticCards: Array<{ Icon: LucideIcon; label: string; value: number; iconClass: string; valueClass: string }> = [
    { Icon: Building2, label: 'Registered universities', value: stats.total, iconClass: 'bg-amber-50 text-amber-700', valueClass: 'text-slate-950' },
    { Icon: ShieldCheck, label: 'Active universities', value: stats.active, iconClass: 'bg-emerald-50 text-emerald-700', valueClass: 'text-emerald-700' },
    { Icon: UsersRound, label: 'University users', value: stats.users, iconClass: 'bg-slate-200/70 text-slate-700', valueClass: 'text-slate-950' },
    { Icon: GraduationCap, label: 'Registered students', value: stats.students, iconClass: 'bg-emerald-50 text-[#02614d]', valueClass: 'text-slate-950' },
  ];
  const handleStructureChanged = useCallback((universityId: string, facultyCount: number) => {
    setUniversities(current => current.map(item => item.id === universityId ? { ...item, facultyCount } : item));
  }, []);

  const errors = validate(form);
  const showError = (key: keyof UniversityForm) => (submitted || touched[key]) ? errors[key] : undefined;
  const setValue = <K extends keyof UniversityForm>(key: K, value: UniversityForm[K]) => setForm(current => ({ ...current, [key]: value }));
  const touch = (key: keyof UniversityForm) => setTouched(current => ({ ...current, [key]: true }));

  const openCreate = () => {
    setEditing(null); setForm(emptyForm); setTouched({}); setSubmitted(false); setError(''); setSuccess('');
    setLogoFile(null); setLogoPreview(''); setRemoveLogo(false); setLogoError(''); setLogoInputKey(value => value + 1); setFormOpen(true);
  };
  const openEdit = (item: ManagedUniversity) => {
    setEditing(item);
    setForm({
      officialName: item.officialName, nameDari: item.nameDari, namePashto: item.namePashto, code: item.code,
      shortName: item.shortName, universityType: item.universityType, province: item.province, city: item.city,
      campusBranch: item.campusBranch, officialAddress: item.officialAddress, officialEmail: item.officialEmail,
      officialPhoneNumber: item.officialPhoneNumber, website: item.website, logoUrl: item.logoUrl,
      isActive: item.isActive, universityAdminUserId: item.assignedAdminUserId ?? '', rowVersion: item.rowVersion,
    });
    setTouched({}); setSubmitted(false); setError(''); setSuccess(''); setFormOpen(true);
    setLogoFile(null); setLogoPreview(item.logoUrl); setRemoveLogo(false); setLogoError(''); setLogoInputKey(value => value + 1);
  };
  const closeForm = () => { if (!saving) { setFormOpen(false); setEditing(null); } };

  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSubmitted(true);
    if (Object.keys(errors).length > 0 || logoError) return;
    setSaving(true); setError(''); setSuccess('');
    const payload = {
      ...form, code: form.code.trim().toUpperCase(), universityAdminUserId: form.universityAdminUserId || null,
      website: form.website.trim() || null, logoUrl: editing?.logoUrl || null,
    };
    try {
      const response = editing
        ? await api.put<ManagedUniversity>(`/api/admin/universities/${editing.id}`, payload)
        : await api.post<ManagedUniversity>('/api/admin/universities', payload);
      let data = response.data;
      if (logoFile) {
        const upload = new FormData();
        upload.append('logo', logoFile);
        data = (await api.post<ManagedUniversity>(`/api/admin/universities/${data.id}/logo`, upload)).data;
      } else if (editing && removeLogo && editing.logoUrl) {
        data = (await api.delete<ManagedUniversity>(`/api/admin/universities/${data.id}/logo`)).data;
      }
      setUniversities(current => editing
        ? current.map(item => item.id === data.id ? data : item).sort((a, b) => a.officialName.localeCompare(b.officialName))
        : [...current, data].sort((a, b) => a.officialName.localeCompare(b.officialName)));
      setSuccess(editing ? 'University information was updated successfully.' : 'The university was registered successfully.');
      setFormOpen(false); setEditing(null);
      if (!editing) setStructureUniversity(data);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(getApiError(requestError, `The university could not be ${editing ? 'updated' : 'registered'}.`));
    } finally { setSaving(false); }
  };

  const selectLogo = (file?: File) => {
    setLogoError('');
    if (!file) return;
    const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
    const extensionValid = /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!allowedTypes.includes(file.type) || !extensionValid) {
      setLogoError('Choose a PNG, JPG/JPEG, or WebP image.'); return;
    }
    if (file.size > 5 * 1024 * 1024) { setLogoError('The university logo must be 5 MB or smaller.'); return; }
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(file); setLogoPreview(URL.createObjectURL(file)); setRemoveLogo(false);
  };

  const restoreLogoBrowsePosition = () => {
    requestAnimationFrame(() => {
      if (formDialogRef.current) formDialogRef.current.scrollTop = logoBrowseScrollTop.current;
    });
  };

  const openLogoPicker = () => {
    logoBrowseScrollTop.current = formDialogRef.current?.scrollTop ?? 0;
    logoInputRef.current?.click();
    restoreLogoBrowsePosition();
  };

  const clearLogo = () => {
    if (logoPreview.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(null); setLogoPreview(''); setRemoveLogo(Boolean(editing?.logoUrl)); setLogoError('');
    setLogoInputKey(value => value + 1);
  };

  const toggleStatus = async (item: ManagedUniversity) => {
    setChangingStatusId(item.id); setError(''); setSuccess('');
    try {
      const { data } = await api.put<ManagedUniversity>(`/api/admin/universities/${item.id}/status`, {
        isActive: !item.isActive, rowVersion: item.rowVersion,
      });
      setUniversities(current => current.map(value => value.id === data.id ? data : value));
      setSuccess(`The university is now ${data.isActive ? 'active' : 'inactive'}. Historical records were preserved.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (requestError) {
      setError(getApiError(requestError, 'The university status could not be changed.'));
    } finally { setChangingStatusId(''); }
  };

  return <section className="min-h-[calc(100vh-4.5rem)] bg-slate-100 px-4 py-6 sm:px-6 md:py-8 lg:px-8">
    <div className="av-card mx-auto w-full max-w-7xl p-5 sm:p-6 md:p-8">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#02382c] shadow-sm"><Building2 className="h-8 w-8" strokeWidth={1.8}/></span>
          <div><p className="text-xs font-bold uppercase tracking-[.24em] text-emerald-700">Platform administration</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Universities</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Register institutions, preserve their official identity, and govern access to the national credential registry.</p></div>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-xl bg-[#02382c] px-5 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-[#034d3d] sm:self-end"><Plus className="h-5 w-5"/>Add university</button>
      </div>

      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
      {success && <p role="status" className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}

      <div className="mt-8 grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {statisticCards.map(({ Icon, label, value, iconClass, valueClass }) => <article key={label} className="av-card-muted flex min-h-32 items-start justify-between gap-4 p-5 sm:p-6"><div className="min-w-0 self-center"><p className="text-xs font-bold uppercase leading-5 tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-3xl font-black tabular-nums ${valueClass}`}>{value}</p></div><span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconClass}`}><Icon className="h-6 w-6" strokeWidth={1.8} aria-hidden="true"/></span></article>)}
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search by name, code, province, or city..." className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pr-4 pl-11 text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"/></div>
        <select value={statusFilter} onChange={event => setStatusFilter(event.target.value as typeof statusFilter)} className="min-h-12 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"><option value="All">All statuses</option><option value="Active">Active</option><option value="Inactive">Inactive</option></select>
      </div>

      <div className="av-card mt-5 overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full min-w-[1060px] text-left">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-extrabold uppercase tracking-[.12em] text-slate-500"><tr><th className="px-5 py-4">University</th><th className="px-5 py-4">Code / Type</th><th className="px-5 py-4">Province / City</th><th className="px-5 py-4">Users</th><th className="px-5 py-4">Students</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {loading && <tr><td colSpan={7} className="px-6 py-14 text-center text-slate-500">Loading registered universities...</td></tr>}
            {!loading && filtered.length === 0 && <tr><td colSpan={7} className="px-6 py-14 text-center text-slate-500">No universities match the current filters.</td></tr>}
            {!loading && filtered.map(item => <tr key={item.id} className="transition hover:bg-slate-50/80">
              <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 font-black text-emerald-800">{item.code}</span><div><p className="font-bold text-slate-900">{item.officialName}</p><p className="mt-0.5 text-xs text-slate-500">{item.shortName}{item.assignedAdminName ? ` · ${item.assignedAdminName}` : ''}</p></div></div></td>
              <td className="px-5 py-4"><p className="font-bold text-slate-800">{item.code}</p><p className="text-xs text-slate-500">{item.universityType}</p></td>
              <td className="px-5 py-4 text-slate-700">{item.province}<span className="block text-xs text-slate-500">{item.city}</span></td>
              <td className="px-5 py-4 font-bold text-slate-800">{item.userCount}</td><td className="px-5 py-4 font-bold text-slate-800">{item.studentCount}</td>
              <td className="px-5 py-4"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${item.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}><span className={`h-2 w-2 rounded-full ${item.isActive ? 'bg-emerald-500' : 'bg-slate-400'}`}/>{item.isActive ? 'Active' : 'Inactive'}</span></td>
              <td className="px-5 py-4 align-middle"><div className="flex items-center justify-end gap-4"><TableActionButton label="Manage Faculties & Departments" onClick={() => setStructureUniversity(item)} className="grid h-9 w-9 place-items-center rounded-lg text-amber-700 transition hover:bg-amber-50"><BookOpen className="h-[18px] w-[18px]"/></TableActionButton><TableActionButton label="View Details" onClick={() => setViewing(item)} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><Eye className="h-[18px] w-[18px]"/></TableActionButton><TableActionButton label="Edit University" onClick={() => openEdit(item)} className="grid h-9 w-9 place-items-center rounded-lg text-emerald-700 transition hover:bg-emerald-50"><Pencil className="h-[18px] w-[18px]"/></TableActionButton><button type="button" role="switch" aria-checked={item.isActive} aria-label={`${item.isActive ? 'Deactivate' : 'Activate'} ${item.officialName}`} disabled={changingStatusId === item.id} onClick={() => void toggleStatus(item)} className={`relative inline-flex h-7 w-12 items-center rounded-full border transition focus:outline-none focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:opacity-50 ${item.isActive ? 'border-[#02382c] bg-[#02382c]' : 'border-slate-300 bg-slate-200'}`}><span className={`h-5 w-5 rounded-full border border-slate-200 bg-white shadow-sm transition-transform ${item.isActive ? 'translate-x-6' : 'translate-x-1'}`}/></button></div></td>
            </tr>)}
          </tbody>
        </table></div>
      </div>
    </div>

    {viewing && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 px-4 py-8 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) setViewing(null); }}><div role="dialog" aria-modal="true" aria-labelledby="university-detail-title" className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8"><div className="flex items-start justify-between gap-4"><div className="flex gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 font-black text-emerald-800">{viewing.code}</span><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">Registered institution</p><h2 id="university-detail-title" className="mt-1 text-2xl font-bold text-slate-950">{viewing.officialName}</h2><p className="text-sm text-slate-500">{viewing.shortName} · {viewing.universityType}</p></div></div><button type="button" onClick={() => setViewing(null)} className="grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-500"><X className="h-5 w-5"/></button></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-2">{[
        ['Location', `${viewing.city}, ${viewing.province}`], ['Campus / Branch', viewing.campusBranch || 'Main campus'],
        ['Official email', viewing.officialEmail], ['Official phone', viewing.officialPhoneNumber],
        ['Website', viewing.website || 'Not provided'], ['University administrator', viewing.assignedAdminName || 'Not assigned'],
        ['Faculties', String(viewing.facultyCount)], ['Credentials', String(viewing.credentialCount)],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p></div>)}</div>
      <div className="mt-4 rounded-xl border border-slate-200 p-4"><p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Official address</p><p className="mt-1 text-sm leading-6 text-slate-700">{viewing.officialAddress}</p></div>
      <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => { setViewing(null); setStructureUniversity(viewing); }} className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-900 hover:bg-amber-100"><BookOpen className="h-4 w-4"/>Manage academic structure</button><button type="button" onClick={() => { setViewing(null); openEdit(viewing); }} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#02382c] px-5 py-3 text-sm font-bold text-white"><Pencil className="h-4 w-4"/>Edit university</button></div>
    </div></div>}

    {formOpen && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/55 px-4 py-6 backdrop-blur-sm"><div ref={formDialogRef} role="dialog" aria-modal="true" aria-labelledby="university-form-title" className="max-h-[92vh] w-full max-w-4xl overflow-y-auto overscroll-contain rounded-3xl border-t-4 border-t-amber-500 bg-white p-6 pb-10 shadow-2xl sm:p-8 sm:pb-10">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">Institution registry</p><h2 id="university-form-title" className="mt-2 text-2xl font-bold text-slate-950">{editing ? 'Edit university' : 'Register a university'}</h2><p className="mt-1 text-sm text-slate-500">University codes become credential prefixes and must remain unique.</p></div><button type="button" onClick={closeForm} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><X className="h-5 w-5"/></button></div>
      <form noValidate onSubmit={save} className="mt-7 space-y-8">
        <fieldset><legend className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#02382c]"><Building2 className="h-5 w-5"/>Basic information</legend><div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 md:col-span-2">Official university name<input value={form.officialName} onChange={e => setValue('officialName', e.target.value)} onBlur={() => touch('officialName')} placeholder="e.g., Kabul University" className={fieldClass(Boolean(showError('officialName')))}/><FieldError message={showError('officialName')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">University code<input value={form.code} onChange={e => setValue('code', e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4))} onBlur={() => touch('code')} placeholder="e.g., KU" className={fieldClass(Boolean(showError('code')))}/><FieldError message={showError('code')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Short name / abbreviation<input value={form.shortName} onChange={e => setValue('shortName', e.target.value)} onBlur={() => touch('shortName')} placeholder="e.g., Kabul University" className={fieldClass(Boolean(showError('shortName')))}/><FieldError message={showError('shortName')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">University type<select value={form.universityType} onChange={e => setValue('universityType', e.target.value as UniversityForm['universityType'])} className={fieldClass(false)}><option value="Public">Public</option><option value="Private">Private</option></select></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Status<select value={form.isActive ? 'active' : 'inactive'} onChange={e => setValue('isActive', e.target.value === 'active')} className={fieldClass(false)}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Province<input value={form.province} onChange={e => setValue('province', e.target.value)} onBlur={() => touch('province')} placeholder="e.g., Kabul" className={fieldClass(Boolean(showError('province')))}/><FieldError message={showError('province')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">City<input value={form.city} onChange={e => setValue('city', e.target.value)} onBlur={() => touch('city')} placeholder="e.g., Kabul City" className={fieldClass(Boolean(showError('city')))}/><FieldError message={showError('city')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Campus / Branch<input value={form.campusBranch} onChange={e => setValue('campusBranch', e.target.value)} placeholder="e.g., Main Campus" className={fieldClass(false)}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Name in Dari (optional)<input value={form.nameDari} onChange={e => setValue('nameDari', e.target.value)} placeholder="نام رسمی پوهنتون" className={fieldClass(false)}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Name in Pashto (optional)<input value={form.namePashto} onChange={e => setValue('namePashto', e.target.value)} placeholder="د پوهنتون رسمي نوم" className={fieldClass(false)}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600 md:col-span-2">Official address<textarea value={form.officialAddress} onChange={e => setValue('officialAddress', e.target.value)} onBlur={() => touch('officialAddress')} rows={3} placeholder="Street, district, city, province" className={fieldClass(Boolean(showError('officialAddress')))}/><FieldError message={showError('officialAddress')}/></label>
        </div></fieldset>

        <fieldset><legend className="text-sm font-extrabold uppercase tracking-wider text-[#02382c]">Contact & branding</legend><div className="mt-4 grid gap-5 md:grid-cols-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Official email<input type="email" value={form.officialEmail} onChange={e => setValue('officialEmail', e.target.value)} onBlur={() => touch('officialEmail')} placeholder="registry@university.edu.af" className={fieldClass(Boolean(showError('officialEmail')))}/><FieldError message={showError('officialEmail')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Official phone number<input type="tel" value={form.officialPhoneNumber} onChange={e => setValue('officialPhoneNumber', e.target.value)} onBlur={() => touch('officialPhoneNumber')} placeholder="e.g., +93 20 000 0000" className={fieldClass(Boolean(showError('officialPhoneNumber')))}/><FieldError message={showError('officialPhoneNumber')}/></label>
          <label className="text-xs font-bold uppercase tracking-wider text-slate-600">Website (optional)<input type="url" value={form.website} onChange={e => setValue('website', e.target.value)} onBlur={() => touch('website')} placeholder="https://university.edu.af" className={fieldClass(Boolean(showError('website')))}/><FieldError message={showError('website')}/></label>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-600">
            University logo <span className="font-medium normal-case text-slate-400">(optional, max 5 MB)</span>
            <div className={`mt-2 rounded-2xl border border-dashed p-4 ${logoError ? 'border-red-500 bg-red-50/40' : 'border-slate-300 bg-slate-50'}`}>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl border border-slate-200 bg-white">
                  {logoPreview ? <img src={logoPreview} alt="University logo preview" className="h-full w-full object-contain p-1"/> : <ImagePlus className="h-8 w-8 text-slate-300" aria-hidden="true"/>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold normal-case text-slate-700">{logoFile?.name || (logoPreview ? 'Current university logo' : 'No logo selected')}</p>
                  <p className="mt-1 text-xs font-medium normal-case leading-5 text-slate-500">PNG, JPG/JPEG, or WebP. The server verifies both file type and binary signature.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" onClick={openLogoPicker} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#02382c] px-4 py-2 text-xs font-bold normal-case text-white transition hover:bg-emerald-900">
                      <ImagePlus className="h-4 w-4" aria-hidden="true"/>{logoPreview ? 'Replace logo' : 'Browse / Choose file'}
                    </button>
                    <input ref={logoInputRef} key={logoInputKey} type="file" accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp" onChange={event => { selectLogo(event.target.files?.[0]); event.target.value = ''; restoreLogoBrowsePosition(); }} className="hidden" tabIndex={-1}/>
                    {logoPreview && <button type="button" onClick={clearLogo} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-red-200 bg-white px-4 py-2 text-xs font-bold normal-case text-red-700 hover:bg-red-50"><Trash2 className="h-4 w-4" aria-hidden="true"/>Remove</button>}
                  </div>
                </div>
              </div>
            </div>
            <FieldError message={logoError}/>
          </div>
        </div></fieldset>

        <fieldset><legend className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-wider text-[#02382c]"><UsersRound className="h-5 w-5"/>University administration</legend><label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-600">Assign existing University Admin (optional)<select value={form.universityAdminUserId} onChange={e => setValue('universityAdminUserId', e.target.value)} className={fieldClass(false)}><option value="">No administrator selected</option>{administrators.map(admin => <option key={admin.id} value={admin.id} disabled={!admin.isActive}>{admin.name} · {admin.email}{admin.universityName ? ` · currently ${admin.universityName}` : ' · unassigned'}</option>)}</select></label><p className="mt-2 flex items-start gap-2 text-xs leading-5 text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700"/>Assignment is enforced on the server. Reassigned administrators are signed out so their next token contains the correct university scope.</p></fieldset>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-6 sm:flex-row sm:justify-end"><button type="button" onClick={closeForm} disabled={saving} className="min-h-12 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancel</button><button type="submit" disabled={saving || (submitted && Object.keys(errors).length > 0)} className="min-h-12 rounded-xl bg-[#02382c] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 hover:bg-[#034d3d] disabled:cursor-not-allowed disabled:opacity-50">{saving ? 'Saving...' : editing ? 'Save changes' : 'Register university'}</button></div>
      </form>
    </div></div>}
    {structureUniversity && <AcademicStructureModal university={structureUniversity} onClose={() => setStructureUniversity(null)} onChanged={handleStructureChanged}/>} 
  </section>;
}

type UnitEditor = {
  kind: 'faculty' | 'department';
  mode: 'create' | 'edit';
  facultyId?: string;
  itemId?: string;
  name: string;
};

function AcademicStructureModal({ university, onClose, onChanged }: {
  university: ManagedUniversity;
  onClose: () => void;
  onChanged: (universityId: string, facultyCount: number) => void;
}) {
  const [structure, setStructure] = useState<AcademicStructure | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editor, setEditor] = useState<UnitEditor | null>(null);
  const [editorSubmitted, setEditorSubmitted] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadData = async () => {
      try {
        const { data } = await api.get<AcademicStructure>(`/api/admin/universities/${university.id}/academic-structure`);
        if (!mounted) return;
        setStructure(data);
        setExpanded(new Set(data.faculties.map(item => item.id)));
        onChanged(university.id, data.faculties.length);
      } catch (requestError) {
        if (mounted) setError(getApiError(requestError, 'The academic structure could not be loaded.'));
      } finally { if (mounted) setLoading(false); }
    };
    void loadData();
    return () => { mounted = false; };
  }, [onChanged, university.id]);

  const refresh = async () => {
    const { data } = await api.get<AcademicStructure>(`/api/admin/universities/${university.id}/academic-structure`);
    setStructure(data);
    onChanged(university.id, data.faculties.length);
  };

  const openFacultyCreate = () => { setEditor({ kind: 'faculty', mode: 'create', name: '' }); setEditorSubmitted(false); setError(''); setSuccess(''); };
  const openFacultyEdit = (faculty: ManagedFaculty) => { setEditor({ kind: 'faculty', mode: 'edit', itemId: faculty.id, name: faculty.name }); setEditorSubmitted(false); setError(''); setSuccess(''); };
  const openDepartmentCreate = (facultyId: string) => { setEditor({ kind: 'department', mode: 'create', facultyId, name: '' }); setEditorSubmitted(false); setError(''); setSuccess(''); };
  const openDepartmentEdit = (facultyId: string, department: ManagedDepartment) => { setEditor({ kind: 'department', mode: 'edit', facultyId, itemId: department.id, name: department.name }); setEditorSubmitted(false); setError(''); setSuccess(''); };

  const saveUnit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editor) return;
    setEditorSubmitted(true);
    const name = editor.name.trim().replace(/\s+/g, ' ');
    if (!name) return;
    setBusyKey('editor'); setError(''); setSuccess('');
    const facultyBase = `/api/admin/universities/${university.id}/faculties`;
    try {
      if (editor.kind === 'faculty') {
        if (editor.mode === 'create') await api.post(facultyBase, { name });
        else await api.put(`${facultyBase}/${editor.itemId}`, { name });
      } else {
        const departmentBase = `${facultyBase}/${editor.facultyId}/departments`;
        if (editor.mode === 'create') await api.post(departmentBase, { name });
        else await api.put(`${departmentBase}/${editor.itemId}`, { name });
      }
      await refresh();
      setSuccess(`${editor.kind === 'faculty' ? 'Faculty' : 'Department'} ${editor.mode === 'create' ? 'added' : 'updated'} successfully.`);
      setEditor(null);
    } catch (requestError) {
      setError(getApiError(requestError, `The ${editor.kind} could not be saved.`));
    } finally { setBusyKey(''); }
  };

  const toggleFaculty = async (faculty: ManagedFaculty) => {
    setBusyKey(faculty.id); setError(''); setSuccess('');
    try {
      await api.put(`/api/admin/universities/${university.id}/faculties/${faculty.id}/status`, { isActive: !faculty.isActive });
      await refresh();
      setSuccess(`Faculty ${faculty.isActive ? 'deactivated' : 'activated'} successfully. Historical records were preserved.`);
    } catch (requestError) { setError(getApiError(requestError, 'The faculty status could not be changed.')); }
    finally { setBusyKey(''); }
  };

  const toggleDepartment = async (faculty: ManagedFaculty, department: ManagedDepartment) => {
    setBusyKey(department.id); setError(''); setSuccess('');
    try {
      await api.put(`/api/admin/universities/${university.id}/faculties/${faculty.id}/departments/${department.id}/status`, { isActive: !department.isActive });
      await refresh();
      setSuccess(`Department ${department.isActive ? 'deactivated' : 'activated'} successfully. Historical records were preserved.`);
    } catch (requestError) { setError(getApiError(requestError, 'The department status could not be changed.')); }
    finally { setBusyKey(''); }
  };

  const toggleExpanded = (facultyId: string) => setExpanded(current => {
    const next = new Set(current);
    if (next.has(facultyId)) next.delete(facultyId); else next.add(facultyId);
    return next;
  });

  return <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/60 px-3 py-5 backdrop-blur-sm sm:px-6">
    <div role="dialog" aria-modal="true" aria-labelledby="academic-structure-title" className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/50 bg-white shadow-2xl">
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
        <div className="flex min-w-0 items-center gap-4"><span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-800"><BookOpen className="h-7 w-7"/></span><div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Academic structure</p><h2 id="academic-structure-title" className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">{university.officialName}</h2><p className="mt-1 text-xs text-slate-500">Each faculty and department remains permanently scoped to this institution.</p></div></div>
        <button type="button" onClick={onClose} disabled={Boolean(busyKey)} aria-label="Close academic structure" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 disabled:opacity-50"><X className="h-5 w-5"/></button>
      </div>

      <div className="overflow-y-auto p-5 sm:p-7">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><p className="text-sm font-bold text-slate-900">Faculties and departments</p><p className="mt-1 text-xs text-slate-500">Inactive units remain attached to historical students and credentials but disappear from new issuance forms.</p></div><button type="button" onClick={openFacultyCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#02382c] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#034d3d]"><Plus className="h-4 w-4"/>Add faculty</button></div>

        {error && <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>}
        {success && <p role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">{success}</p>}
        {loading && <div className="grid min-h-56 place-items-center text-sm text-slate-500">Loading academic structure...</div>}
        {!loading && structure?.faculties.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center"><BookOpen className="mx-auto h-9 w-9 text-slate-400"/><p className="mt-3 font-bold text-slate-800">No faculties registered yet</p><p className="mt-1 text-sm text-slate-500">Add the university’s first faculty, then attach its departments.</p></div>}

        <div className="mt-6 space-y-4">{structure?.faculties.map(faculty => {
          const isExpanded = expanded.has(faculty.id);
          return <section key={faculty.id} className={`overflow-hidden ${faculty.isActive ? 'av-card' : 'av-card-muted'}`}>
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <button type="button" onClick={() => toggleExpanded(faculty.id)} aria-expanded={isExpanded} className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800">{isExpanded ? <ChevronDown className="h-5 w-5"/> : <ChevronRight className="h-5 w-5"/>}</span><span className="min-w-0"><span className="block truncate font-bold text-slate-900">{faculty.name}</span><span className="mt-0.5 block text-xs text-slate-500">{faculty.departments.length} departments · {faculty.studentCount} students</span></span></button>
              <div className="flex items-center justify-end gap-2"><span className={`mr-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${faculty.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>{faculty.isActive ? 'Active' : 'Inactive'}</span><button type="button" onClick={() => openDepartmentCreate(faculty.id)} title="Add department" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-emerald-800 hover:bg-emerald-50"><Plus className="h-4 w-4"/>Department</button><button type="button" onClick={() => openFacultyEdit(faculty)} title="Edit faculty" className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-800"><Pencil className="h-4 w-4"/></button><button type="button" role="switch" aria-checked={faculty.isActive} aria-label={`${faculty.isActive ? 'Deactivate' : 'Activate'} ${faculty.name}`} disabled={busyKey === faculty.id} onClick={() => void toggleFaculty(faculty)} className={`relative inline-flex h-7 w-12 items-center rounded-full border transition focus:ring-4 focus:ring-emerald-100 disabled:opacity-50 ${faculty.isActive ? 'border-[#02382c] bg-[#02382c]' : 'border-slate-300 bg-slate-200'}`}><span className={`h-5 w-5 rounded-full bg-white shadow transition-transform ${faculty.isActive ? 'translate-x-6' : 'translate-x-1'}`}/></button></div>
            </div>
            {isExpanded && <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-4 sm:px-5">
              {faculty.departments.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center text-sm text-slate-500">No departments registered in this faculty.</p> : <div className="grid gap-3 md:grid-cols-2">{faculty.departments.map(department => <div key={department.id} className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5"><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{department.name}</p><p className="mt-0.5 text-[11px] text-slate-500">{department.studentCount} students · <span className={department.isActive ? 'text-emerald-700' : 'text-slate-500'}>{department.isActive ? 'Active' : 'Inactive'}</span></p></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => openDepartmentEdit(faculty.id, department)} title="Edit department" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-emerald-800"><Pencil className="h-4 w-4"/></button><button type="button" role="switch" aria-checked={department.isActive} aria-label={`${department.isActive ? 'Deactivate' : 'Activate'} ${department.name}`} disabled={busyKey === department.id} onClick={() => void toggleDepartment(faculty, department)} className={`relative inline-flex h-6 w-10 items-center rounded-full border transition focus:ring-4 focus:ring-emerald-100 disabled:opacity-50 ${department.isActive ? 'border-[#02382c] bg-[#02382c]' : 'border-slate-300 bg-slate-200'}`}><span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${department.isActive ? 'translate-x-5' : 'translate-x-1'}`}/></button></div></div>)}</div>}
            </div>}
          </section>;
        })}</div>
      </div>
    </div>

    {editor && <div className="fixed inset-0 z-[60] grid place-items-center bg-slate-950/45 px-4 backdrop-blur-sm"><div role="dialog" aria-modal="true" aria-labelledby="academic-unit-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-700">{editor.kind}</p><h3 id="academic-unit-title" className="mt-1 text-xl font-bold text-slate-950">{editor.mode === 'create' ? 'Add' : 'Edit'} {editor.kind}</h3></div><button type="button" onClick={() => setEditor(null)} disabled={Boolean(busyKey)} className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500"><X className="h-4 w-4"/></button></div><form noValidate onSubmit={saveUnit} className="mt-5"><label className="text-xs font-bold uppercase tracking-wider text-slate-600">Official name<input autoFocus value={editor.name} onChange={event => setEditor(current => current ? { ...current, name: event.target.value } : current)} placeholder={editor.kind === 'faculty' ? 'e.g., Faculty of Engineering' : 'e.g., Civil Engineering'} className={fieldClass(editorSubmitted && !editor.name.trim())}/>{editorSubmitted && !editor.name.trim() && <FieldError message="Name is required."/>}</label><div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => setEditor(null)} disabled={Boolean(busyKey)} className="min-h-11 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button><button type="submit" disabled={Boolean(busyKey)} className="min-h-11 rounded-xl bg-[#02382c] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#034d3d] disabled:opacity-50">{busyKey ? 'Saving...' : 'Save'}</button></div></form></div></div>}
  </div>;
}
