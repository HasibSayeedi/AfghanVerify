import { useEffect, useState } from 'react';
import { FileClock, Search, ShieldCheck, X } from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { api, getApiError, readSession } from '../../lib/api';
import RecordsPagination from '../../components/RecordsPagination';

interface AuditEntry {
  id: string;
  createdAt: string;
  userId: string;
  userName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  outcome: string;
  ipAddress: string;
  userAgent: string;
}

interface AuditResponse {
  items: AuditEntry[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  filters: { actions: string[]; entityTypes: string[]; outcomes: string[] };
}

const prettyLabel = (value: string) => value
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replaceAll('_', ' ')
  .trim();

const prettyDetails = (value: string) => {
  if (!value) return 'No additional details were recorded.';
  try { return JSON.stringify(JSON.parse(value), null, 2); } catch { return value; }
};

const roleLabel = (value: string) => ({
  SUPER_ADMIN: 'Super administrator', UNIVERSITY_ADMIN: 'University administrator',
  University: 'University registrar', Ministry: 'Ministry Reviewer',
}[value] ?? prettyLabel(value || 'System'));

const selectClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100';

export default function AuditLogs() {
  const session = readSession();
  if (session?.role !== 'SUPER_ADMIN') return <Navigate to="/login" replace />;
  return <AuditLogsPage />;
}

function AuditLogsPage() {
  const [data, setData] = useState<AuditResponse | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [action, setAction] = useState('');
  const [entityType, setEntityType] = useState('');
  const [outcome, setOutcome] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedQuery(query.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setError('');
      try {
        const response = await api.get<AuditResponse>('/api/admin/audit-logs', {
          signal: controller.signal,
          params: { page, pageSize: 15, query: debouncedQuery || undefined, action: action || undefined,
            entityType: entityType || undefined, outcome: outcome || undefined,
            from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
            to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined },
        });
        setData(response.data);
      } catch (requestError) {
        if (!controller.signal.aborted) setError(getApiError(requestError, 'Audit logs could not be loaded.'));
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };
    void load();
    return () => controller.abort();
  }, [action, debouncedQuery, entityType, from, outcome, page, to]);

  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', closeOnEscape); };
  }, [selected]);

  const hasFilters = Boolean(query || action || entityType || outcome || from || to);
  const clearFilters = () => { setQuery(''); setAction(''); setEntityType(''); setOutcome(''); setFrom(''); setTo(''); setPage(1); };
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
    <section className="av-card av-card-pad">
      <header className="flex flex-col gap-4 border-b border-slate-100 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#02382c]"><FileClock className="h-7 w-7" aria-hidden="true" /></span>
          <div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Platform administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Audit logs</h1><p className="mt-1 text-sm text-slate-500">A read-only trail of sensitive platform activity.</p></div>
        </div>
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-900"><span className="font-extrabold">{data?.totalCount ?? 0}</span> matching events</div>
      </header>

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative md:col-span-2 xl:col-span-2"><span className="sr-only">Search audit logs</span><Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" aria-hidden="true" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search user, action, resource or ID" className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100" /></label>
        <label><span className="sr-only">Filter by action</span><select value={action} onChange={event => { setAction(event.target.value); setPage(1); }} className={selectClass}><option value="">All actions</option>{data?.filters.actions.map(value => <option key={value} value={value}>{prettyLabel(value)}</option>)}</select></label>
        <label><span className="sr-only">Filter by resource</span><select value={entityType} onChange={event => { setEntityType(event.target.value); setPage(1); }} className={selectClass}><option value="">All resources</option>{data?.filters.entityTypes.map(value => <option key={value} value={value}>{prettyLabel(value)}</option>)}</select></label>
        <label><span className="sr-only">Filter by status</span><select value={outcome} onChange={event => { setOutcome(event.target.value); setPage(1); }} className={selectClass}><option value="">All statuses</option>{data?.filters.outcomes.map(value => <option key={value} value={value}>{prettyLabel(value)}</option>)}</select></label>
        <button type="button" onClick={clearFilters} disabled={!hasFilters} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-600 hover:border-emerald-300 hover:text-emerald-800 disabled:opacity-40"><X className="h-4 w-4" />Clear</button>
        <label className="text-xs font-semibold text-slate-600">From<input type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(1); }} className={`${selectClass} mt-1`} /></label>
        <label className="text-xs font-semibold text-slate-600">To<input type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(1); }} className={`${selectClass} mt-1`} /></label>
      </div>

      {error && <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">{error}</div>}
      {loading ? <div className="grid min-h-64 place-items-center" role="status"><span className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700" /><span className="sr-only">Loading audit logs</span></div>
        : !data?.items.length ? <div className="my-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-14 text-center"><FileClock className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-3 font-bold text-slate-800">No audit events found</h2><p className="mt-1 text-sm text-slate-500">Adjust the search or filters to see other activity.</p></div>
        : <>
          <div className="mt-6 hidden overflow-hidden rounded-xl border border-slate-200 xl:block">
            <table className="w-full table-fixed text-left text-sm"><thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500"><tr><th className="w-[17%] px-3 py-3 xl:px-4">Date &amp; time</th><th className="w-[22%] px-3 py-3 xl:px-4">User / role</th><th className="w-[19%] px-3 py-3 xl:px-4">Action</th><th className="w-[22%] px-3 py-3 xl:px-4">Resource</th><th className="w-[12%] px-3 py-3 xl:px-4">Status</th><th className="w-[8%] px-3 py-3 text-right xl:px-4">Details</th></tr></thead>
              <tbody className="divide-y divide-slate-100">{data.items.map(entry => <tr key={entry.id} className="hover:bg-slate-50/80"><td className="whitespace-nowrap px-4 py-4 text-slate-600"><span className="block font-semibold text-slate-800">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(entry.createdAt))}</span><span className="text-xs">{new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(new Date(entry.createdAt))}</span></td><td className="max-w-56 px-4 py-4"><span className="block truncate font-semibold text-slate-900">{entry.userName || 'System'}</span><span className="block truncate text-xs text-slate-500">{roleLabel(entry.actorRole)}</span></td><td className="px-4 py-4 font-semibold text-slate-700">{prettyLabel(entry.action)}</td><td className="px-4 py-4"><span className="block font-semibold text-slate-700">{prettyLabel(entry.entityType)}</span><span className="block max-w-44 truncate font-mono text-xs text-slate-500" title={entry.entityId}>{entry.entityId || '—'}</span></td><td className="px-4 py-4"><StatusBadge value={entry.outcome} /></td><td className="px-4 py-4 text-right"><button type="button" onClick={() => setSelected(entry)} className="rounded-lg px-3 py-2 font-semibold text-emerald-800 hover:bg-emerald-50">View</button></td></tr>)}</tbody>
            </table>
          </div>
          <div className="mt-5 grid gap-3 xl:hidden">{data.items.map(entry => <button type="button" key={entry.id} onClick={() => setSelected(entry)} className="av-card-muted w-full p-4 text-left transition hover:border-emerald-300"><span className="flex items-start justify-between gap-3"><span><span className="block font-bold text-slate-900">{prettyLabel(entry.action)}</span><span className="mt-1 block text-xs text-slate-500">{entry.userName || 'System'} · {roleLabel(entry.actorRole)}</span></span><StatusBadge value={entry.outcome} /></span><span className="mt-3 flex items-end justify-between gap-3 text-xs text-slate-500"><span>{prettyLabel(entry.entityType)}<span className="block max-w-52 truncate font-mono">{entry.entityId || '—'}</span></span><time className="whitespace-nowrap">{new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(entry.createdAt))}</time></span></button>)}</div>
        </>}

      {!loading&&data&&<div className="mt-6"><RecordsPagination page={data.page} totalPages={Math.max(data.totalPages,1)} onChange={nextPage => setPage(nextPage)}/></div>}
    </section>

    {selected && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setSelected(null); }}><section role="dialog" aria-modal="true" aria-labelledby="audit-detail-title" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-8"><header className="flex items-start justify-between gap-4"><div className="flex gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800"><ShieldCheck className="h-6 w-6" /></span><div><h2 id="audit-detail-title" className="text-xl font-bold text-slate-900">{prettyLabel(selected.action)}</h2><p className="mt-1 text-sm text-slate-500">Immutable audit event details</p></div></div><button type="button" onClick={() => setSelected(null)} aria-label="Close audit details" className="grid h-10 w-10 place-items-center rounded-lg text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button></header><dl className="mt-6 grid gap-4 rounded-xl bg-slate-50 p-4 sm:grid-cols-2"><Detail label="Date and time" value={new Intl.DateTimeFormat(undefined, { dateStyle: 'full', timeStyle: 'long' }).format(new Date(selected.createdAt))} /><Detail label="Status" value={prettyLabel(selected.outcome)} /><Detail label="User" value={selected.userName || 'System'} /><Detail label="Role" value={roleLabel(selected.actorRole)} /><Detail label="Resource" value={prettyLabel(selected.entityType)} /><Detail label="Resource ID" value={selected.entityId || '—'} /><Detail label="IP address" value={selected.ipAddress || 'Not recorded'} /><Detail label="User ID" value={selected.userId || 'Not recorded'} /></dl><div className="mt-5"><h3 className="text-sm font-bold text-slate-800">Details</h3><pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">{prettyDetails(selected.details)}</pre></div><div className="mt-6 flex justify-end"><button type="button" onClick={() => setSelected(null)} className="rounded-lg bg-[#02382c] px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-900">Close</button></div></section></div>}
  </div>;
}

function StatusBadge({ value }: { value: string }) {
  const succeeded = !value || value.toLowerCase() === 'succeeded';
  return <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${succeeded ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{prettyLabel(value || 'Succeeded')}</span>;
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-[11px] font-bold uppercase tracking-wider text-slate-500">{label}</dt><dd className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</dd></div>;
}
