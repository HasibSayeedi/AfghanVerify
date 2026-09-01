import { useEffect, useMemo, useState } from 'react';
import { FileCheck2, PencilLine, Search, X, XCircle } from 'lucide-react';
import { api, getApiError } from '../../lib/api';
import type { Grade } from '../../types';

export interface IssuedCredential {
  verificationCode: string;
  status: string;
  issuedAt: string;
  firstName: string;
  lastName: string;
  fatherName: string;
  tazkiraNumber: string;
  universityId: string;
  facultyId: string;
  departmentId: string;
  faculty: string;
  department: string;
  graduationYear: number;
  documentType: string;
  gpa: string;
  profilePicture: string;
  issuanceSystem: string;
  legacyMaktoubNumber: string;
  diplomaFileUrl: string;
  transcriptFileUrl: string;
  supersedesVerificationCode?: string;
  subjects: Grade[];
}

const statusLabel = (status: string) => status === 'PendingMinistry' ? 'Awaiting Ministry review' : status === 'Verified' ? 'Approved' : status;
const statusClass = (status: string) => status === 'PendingMinistry'
  ? 'border-amber-200 bg-amber-50 text-amber-800'
  : status === 'Verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : status === 'Rejected' || status === 'Revoked' || status === 'Cancelled' ? 'border-red-200 bg-red-50 text-red-700'
      : 'border-slate-200 bg-slate-100 text-slate-700';

export default function IssuedRecords({ onEdit }: { onEdit: (record: IssuedCredential) => void }) {
  const [records, setRecords] = useState<IssuedCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [query, setQuery] = useState('');
  const [cancelCandidate, setCancelCandidate] = useState<IssuedCredential | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<IssuedCredential | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelError, setCancelError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = async () => {
    setLoading(true); setError('');
    try { const { data } = await api.get<IssuedCredential[]>('/api/certificates/issued'); setRecords(data); }
    catch (requestError) { setError(getApiError(requestError, 'The university records could not be loaded.')); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    let active = true;
    api.get<IssuedCredential[]>('/api/certificates/issued')
      .then(({ data }) => { if (active) setRecords(data); })
      .catch(requestError => { if (active) setError(getApiError(requestError, 'The university records could not be loaded.')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const visibleRecords = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return records;
    return records.filter(record => [record.firstName, record.lastName, `${record.firstName} ${record.lastName}`, record.verificationCode, record.tazkiraNumber]
      .some(value => value.toLocaleLowerCase().includes(normalized)));
  }, [query, records]);

  const closeCancel = () => { if (cancelling) return; setCancelCandidate(null); setCancelReason(''); setCancelError(''); };
  const confirmCancel = async () => {
    if (!cancelCandidate) return;
    const reason = cancelReason.trim();
    if (reason.length < 10) { setCancelError('Provide a clear cancellation reason of at least 10 characters.'); return; }
    setCancelling(true); setCancelError(''); setError(''); setSuccess('');
    try {
      const { data } = await api.post<{ message: string }>(`/api/certificates/${encodeURIComponent(cancelCandidate.verificationCode)}/cancel`, { reason });
      setRecords(current => current.map(record => record.verificationCode === cancelCandidate.verificationCode ? { ...record, status:'Cancelled' } : record));
      setSuccess(data.message); setCancelCandidate(null); setCancelReason('');
      requestAnimationFrame(() => window.scrollTo({ top:0, behavior:'smooth' }));
    } catch (requestError) { setCancelError(getApiError(requestError, 'The pending credential could not be cancelled.')); }
    finally { setCancelling(false); }
  };

  return <section className="rounded-3xl border border-slate-200 bg-white shadow-sm">
    <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div><div className="flex items-center gap-3"><FileCheck2 className="h-6 w-6 text-emerald-700" aria-hidden="true"/><h2 className="text-xl font-black text-slate-900">Issued records</h2></div><p className="mt-1 text-sm text-slate-500">Correct or cancel records while they are still awaiting Ministry review.</p></div>
      <button type="button" onClick={() => void load()} disabled={loading} className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50">Refresh</button>
    </div>

    <div className="p-5 sm:p-6">
      {success && <p role="status" className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800">{success}</p>}
      {error && <p role="alert" className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
      <div className="relative mb-5 w-full sm:max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true"/>
        <input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search student, Tazkira, or credential code" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-4 focus:ring-emerald-100"/>
      </div>

      {loading ? <div className="py-16 text-center text-sm font-semibold text-slate-500">Loading issued records...</div>
        : visibleRecords.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-200 py-16 text-center"><p className="font-bold text-slate-700">No issued records found.</p><p className="mt-1 text-sm text-slate-500">New credentials will appear here after submission.</p></div>
          : <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">{visibleRecords.map(record => {
            const pending = record.status === 'PendingMinistry';
            return <article key={record.verificationCode} role="button" tabIndex={0} aria-label={`View credential details for ${record.firstName} ${record.lastName}`} onClick={() => setSelectedRecord(record)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setSelectedRecord(record); } }} className="grid cursor-pointer gap-4 p-4 transition-colors hover:bg-emerald-50/40 focus:bg-emerald-50/40 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:p-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-black text-slate-900">{record.firstName} {record.lastName}</h3><span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${statusClass(record.status)}`}>{statusLabel(record.status)}</span></div><p className="mt-1 truncate text-xs text-slate-500">{record.faculty} · {record.department}</p><p className="mt-2 text-xs text-slate-400">Issued {new Date(record.issuedAt).toLocaleDateString()}</p></div>
              <div className="min-w-0"><code className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-black tracking-wider text-slate-700">{record.verificationCode}</code><p className="mt-2 text-xs text-slate-500">Graduation {record.graduationYear} · GPA {record.gpa}</p></div>
              <div className="flex flex-wrap gap-2 lg:justify-end">{pending ? <><button type="button" onClick={event => { event.stopPropagation(); onEdit(record); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#02382c] px-4 py-2 text-xs font-bold text-white hover:bg-emerald-900"><PencilLine className="h-4 w-4" aria-hidden="true"/>Correct</button><button type="button" onClick={event => { event.stopPropagation(); setCancelCandidate(record); setCancelReason(''); setCancelError(''); }} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-200 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-50"><XCircle className="h-4 w-4" aria-hidden="true"/>Cancel</button></> : <span className="text-xs font-medium text-slate-400">Finalized · read only</span>}</div>
            </article>;
          })}</div>}
    </div>

    {selectedRecord && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-sm sm:px-8 sm:py-10" onMouseDown={event => { if (event.target === event.currentTarget) setSelectedRecord(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="credential-details-title" className="flex max-h-[calc(100dvh-3rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[calc(100dvh-5rem)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
          <div className="min-w-0"><p className="text-xs font-black uppercase tracking-[.18em] text-emerald-700">Credential details</p><h3 id="credential-details-title" className="mt-2 text-2xl font-black text-slate-900">{selectedRecord.firstName} {selectedRecord.lastName}</h3><div className="mt-2 flex flex-wrap items-center gap-2"><code className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-black tracking-wider text-slate-700">{selectedRecord.verificationCode}</code><span className={`rounded-full border px-2.5 py-1 text-[10px] font-extrabold ${statusClass(selectedRecord.status)}`}>{statusLabel(selectedRecord.status)}</span></div></div>
          <button type="button" onClick={() => setSelectedRecord(null)} aria-label="Close credential details" className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900"><X className="h-5 w-5" aria-hidden="true"/></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">{[
            ['Father’s name',selectedRecord.fatherName],['Tazkira number',selectedRecord.tazkiraNumber],
            ['Faculty',selectedRecord.faculty],['Department',selectedRecord.department],
            ['Graduation year',String(selectedRecord.graduationYear)],['GPA',selectedRecord.gpa],
            ['Document type',selectedRecord.documentType],['Issuance system',selectedRecord.issuanceSystem],
            ['Issued date',new Date(selectedRecord.issuedAt).toLocaleString()],['Legacy Maktoub',selectedRecord.legacyMaktoubNumber || 'Not applicable'],
            ['Replaces credential',selectedRecord.supersedesVerificationCode || 'Not applicable']
          ].map(([term,value]) => <div key={term} className="border-b border-slate-100 pb-3"><dt className="text-[10px] font-extrabold uppercase tracking-wide text-slate-400">{term}</dt><dd className="mt-1 break-words text-sm font-bold text-slate-800">{value}</dd></div>)}</dl>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">{selectedRecord.diplomaFileUrl && <a href={selectedRecord.diplomaFileUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-200 px-4 py-3 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-50">Open diploma file</a>}{selectedRecord.transcriptFileUrl && <a href={selectedRecord.transcriptFileUrl} target="_blank" rel="noreferrer" className="rounded-xl border border-emerald-200 px-4 py-3 text-center text-sm font-bold text-emerald-800 hover:bg-emerald-50">Open transcript file</a>}</div>

          <section className="mt-7"><div className="flex items-center justify-between gap-3"><h4 className="font-black text-slate-900">Transcript courses</h4><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{selectedRecord.subjects.length}</span></div>{selectedRecord.subjects.length === 0 ? <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No transcript courses were attached.</p> : <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[560px] text-left text-sm"><thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Course</th><th className="px-4 py-3 text-center">Semester</th><th className="px-4 py-3 text-center">Score</th><th className="px-4 py-3 text-center">Credits</th></tr></thead><tbody className="divide-y divide-slate-100">{selectedRecord.subjects.map((subject,index) => <tr key={`${subject.semesterNumber}-${subject.subjectName}-${index}`}><td className="px-4 py-3 font-semibold text-slate-800">{subject.subjectName}</td><td className="px-4 py-3 text-center">{subject.semesterNumber}</td><td className="px-4 py-3 text-center font-bold text-emerald-800">{subject.score}</td><td className="px-4 py-3 text-center">{subject.creditHours}</td></tr>)}</tbody></table></div>}</section>
        </div>

        <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:justify-end sm:px-6">{selectedRecord.status === 'PendingMinistry' && <button type="button" onClick={() => { const record=selectedRecord;setSelectedRecord(null);onEdit(record); }} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#02382c] px-5 py-2.5 text-sm font-bold text-white hover:bg-emerald-900"><PencilLine className="h-4 w-4" aria-hidden="true"/>Correct this record</button>}<button type="button" onClick={() => setSelectedRecord(null)} className="min-h-11 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">Close</button></div>
      </div>
    </div>}

    {cancelCandidate && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4 backdrop-blur-sm" onMouseDown={event => { if (event.target === event.currentTarget) closeCancel(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cancel-credential-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600"><XCircle className="h-7 w-7" aria-hidden="true"/></span>
        <h3 id="cancel-credential-title" className="mt-4 text-xl font-black text-slate-900">Cancel pending credential?</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">This removes <strong className="text-slate-700">{cancelCandidate.verificationCode}</strong> from the Ministry review queue. The audit record will be retained.</p>
        <label className="mt-5 block text-xs font-bold uppercase tracking-wide text-slate-600">Official cancellation reason<textarea autoFocus rows={4} maxLength={500} value={cancelReason} onChange={event => { setCancelReason(event.target.value); if (cancelError) setCancelError(''); }} className={`mt-2 w-full resize-none rounded-xl border p-3 text-sm font-normal normal-case tracking-normal outline-none focus:ring-4 ${cancelError ? 'border-red-400 focus:ring-red-100' : 'border-slate-200 focus:border-emerald-600 focus:ring-emerald-100'}`} placeholder="Explain the data-entry mistake or reason for cancellation..."/></label>
        {cancelError && <p role="alert" className="mt-2 text-xs font-semibold text-red-600">{cancelError}</p>}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" disabled={cancelling} onClick={closeCancel} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Keep record</button><button type="button" disabled={cancelling} onClick={() => void confirmCancel()} className="rounded-xl bg-red-600 px-4 py-3 text-sm font-bold text-white hover:bg-red-700 disabled:opacity-50">{cancelling ? 'Cancelling...' : 'Yes, cancel record'}</button></div>
      </div>
    </div>}
  </section>;
}
