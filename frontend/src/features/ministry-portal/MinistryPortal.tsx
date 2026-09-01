import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Search, ShieldCheck, X } from 'lucide-react';
import { api, getApiError } from '../../lib/api';

interface QueueItem {
  trackingCode:string;
  studentName:string;
  fatherName:string;
  universityName:string;
  faculty:string;
  department:string;
  documentType:string;
  gpa:string;
  submittedAt:string;
  issuanceSystem:string;
  legacyMaktoubNumber?:string;
  status?:'Approved'|'Rejected'|'Suspended'|'Revoked'|'Superseded';
  reviewedAt?:string;
  remarks?:string;
}

type RecordsTab = 'pending'|'history';
type StatisticsPeriod = 'week'|'month'|'year';

interface ReviewStatistics {
  period:StatisticsPeriod;
  startsAt:string;
  generatedAt:string;
  awaitingReview:number;
  approved:number;
  rejected:number;
}

const statisticsPeriods: { value:StatisticsPeriod; label:string }[] = [
  { value:'week',label:'This Week' },
  { value:'month',label:'This Month' },
  { value:'year',label:'This Year' }
];

const emptyStatistics = (period:StatisticsPeriod):ReviewStatistics => ({
  period,startsAt:'',generatedAt:'',awaitingReview:0,approved:0,rejected:0
});

const matchesHistorySearch = (record:QueueItem, query:string) => {
  const normalizedQuery=query.trim().toLocaleLowerCase();
  return !normalizedQuery||[record.studentName,record.universityName,record.trackingCode]
    .some(value=>value.toLocaleLowerCase().includes(normalizedQuery));
};

const historyStatusClass=(status:QueueItem['status'])=>status==='Approved'
  ?'bg-emerald-100 text-emerald-800'
  :status==='Suspended'?'bg-amber-100 text-amber-800'
    :status==='Superseded'?'bg-slate-200 text-slate-700':'bg-red-100 text-red-700';

interface HistorySearchProps {
  value:string;
  onChange:(value:string)=>void;
  resultCount:number;
  totalCount:number;
}

function HistorySearch({value,onChange,resultCount,totalCount}:HistorySearchProps) {
  return <div className="px-4 py-4 sm:px-6">
    <div role="search" className="w-full sm:w-1/2">
      <label htmlFor="history-search" className="sr-only">Search processed credentials</label>
      <div className="group relative w-full" dir="ltr">
        <span
          className="pointer-events-none absolute top-1/2 z-10 flex -translate-y-1/2 items-center justify-center"
          style={{left:'1.125rem'}}
        >
          <Search className="h-[18px] w-[18px] text-slate-400 transition-colors group-focus-within:text-emerald-700" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <input
          id="history-search"
          type="text"
          value={value}
          onChange={event=>onChange(event.target.value)}
          aria-describedby="history-search-hint history-search-count"
          autoComplete="off"
          spellCheck="false"
          placeholder="Search by student, university, or archive code"
          className={`block min-h-12 w-full rounded-xl border border-slate-200 bg-white py-3 pl-12 text-sm leading-6 text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100 ${value?'pr-11':'pr-4'}`}
          style={{paddingLeft:'3rem'}}
        />
        {value&&<button type="button" onClick={()=>onChange('')} aria-label="Clear history search" className="absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" style={{right:'0.5rem',left:'auto'}}>
          <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
        </button>}
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-slate-500">
        <span id="history-search-hint">Searches student, university, and archive code.</span>
        <span id="history-search-count" aria-live="polite" className="font-semibold text-slate-600">{value.trim()?`${resultCount} of ${totalCount} records`:`${totalCount} processed records`}</span>
      </div>
    </div>
  </div>;
}

export default function MinistryPortal() {
  const [queue,setQueue]=useState<QueueItem[]>([]);
  const [selected,setSelected]=useState<QueueItem|null>(null);
  const [recordsTab,setRecordsTab]=useState<RecordsTab>('pending');
  const [history,setHistory]=useState<QueueItem[]>([]);
  const [historyLoaded,setHistoryLoaded]=useState(false);
  const [historyLoading,setHistoryLoading]=useState(false);
  const [historyQuery,setHistoryQuery]=useState('');
  const [remarks,setRemarks]=useState('');
  const [remarksError,setRemarksError]=useState('');
  const [lifecycleReason,setLifecycleReason]=useState('');
  const [lifecycleError,setLifecycleError]=useState('');
  const [message,setMessage]=useState<{error?:boolean;text:string}|null>(null);
  const [loading,setLoading]=useState(false);
  const [statisticsPeriod,setStatisticsPeriod]=useState<StatisticsPeriod>('week');
  const [statistics,setStatistics]=useState<ReviewStatistics>(()=>emptyStatistics('week'));
  const [statisticsLoading,setStatisticsLoading]=useState(true);
  const statisticsRequestId=useRef(0);

  const filteredHistory=history.filter(record=>matchesHistorySearch(record,historyQuery));

  const load=async()=>{
    try {
      const {data}=await api.get<QueueItem[]>('/api/ministry/queue');
      setQueue(data);
    } catch(error) {
      setMessage({error:true,text:getApiError(error,'Could not load the review queue.')});
    }
  };

  const loadHistory=async()=>{
    setHistoryLoading(true);
    try {
      const {data}=await api.get<QueueItem[]>('/api/ministry/history');
      setHistory(data);
      setHistoryLoaded(true);
    } catch(error) {
      setMessage({error:true,text:getApiError(error,'Could not load processed credential history.')});
    } finally {
      setHistoryLoading(false);
    }
  };

  const loadStatistics=async(period:StatisticsPeriod)=>{
    const requestId=++statisticsRequestId.current;
    setStatisticsLoading(true);
    try {
      const {data}=await api.get<ReviewStatistics>('/api/ministry/statistics',{params:{period}});
      if(requestId===statisticsRequestId.current)setStatistics(data);
    } catch {
      if(requestId===statisticsRequestId.current)setStatistics(emptyStatistics(period));
    } finally {
      if(requestId===statisticsRequestId.current)setStatisticsLoading(false);
    }
  };

  useEffect(()=>{
    let active=true;
    void api.get<QueueItem[]>('/api/ministry/queue')
      .then(({data})=>{if(active)setQueue(data);})
      .catch(error=>{if(active)setMessage({error:true,text:getApiError(error,'Could not load the review queue.')});});
    void api.get<ReviewStatistics>('/api/ministry/statistics',{params:{period:'week'}})
      .then(({data})=>{if(active)setStatistics(data);})
      .catch(()=>{if(active)setStatistics(emptyStatistics('week'));})
      .finally(()=>{if(active)setStatisticsLoading(false);});
    return()=>{active=false;};
  },[]);

  const changeStatisticsPeriod=(period:StatisticsPeriod)=>{
    if(period===statisticsPeriod&&!statisticsLoading)return;
    setStatisticsPeriod(period);
    void loadStatistics(period);
  };

  const changeRecordsTab=(tab:RecordsTab)=>{
    setRecordsTab(tab);
    setSelected(null);
    setRemarks('');
    setRemarksError('');
    setLifecycleReason('');
    setLifecycleError('');
    if(tab==='history'&&!historyLoaded&&!historyLoading)void loadHistory();
  };

  const refreshRecords=()=>{
    setMessage(null);
    if(recordsTab==='pending')void load();
    else void loadHistory();
  };

  const review=async(action:'verify'|'reject')=>{
    if(!selected)return;
    const decisionRemarks=remarks.trim();
    if(action==='reject'&&!decisionRemarks){
      setRemarksError('Please provide an official decision note explaining the reason for rejection before rejecting this credential.');
      return;
    }
    setRemarksError('');
    setLoading(true);
    setMessage(null);
    try {
      const reviewedRecord=selected;
      const {data}=await api.post('/api/ministry/review',{code:reviewedRecord.trackingCode,action,remarks:decisionRemarks});
      const processedRecord:QueueItem={
        ...reviewedRecord,
        status:data.status==='Verified'?'Approved':'Rejected',
        remarks:decisionRemarks,
        reviewedAt:new Date().toISOString()
      };
      setQueue(current=>current.filter(item=>item.trackingCode!==reviewedRecord.trackingCode));
      setHistory(current=>[processedRecord,...current.filter(item=>item.trackingCode!==reviewedRecord.trackingCode)]);
      setHistoryLoaded(true);
      setMessage({text:data.message});
      setSelected(null);
      setRemarks('');
      await Promise.all([load(),loadHistory(),loadStatistics(statisticsPeriod)]);
      requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));
    } catch(error) {
      setMessage({error:true,text:getApiError(error,'The decision could not be recorded.')});
    } finally {
      setLoading(false);
    }
  };

  const selectPending=(item:QueueItem)=>{
    setSelected(item);
    setRemarks('');
    setRemarksError('');
    setMessage(null);
  };

  const selectHistory=(item:QueueItem)=>{
    setSelected(item);
    setRemarksError('');
    setLifecycleReason('');
    setLifecycleError('');
    setMessage(null);
  };

  const updateLifecycle=async(action:'suspend'|'reinstate'|'revoke')=>{
    if(!selected)return;
    const reason=lifecycleReason.trim();
    if(reason.length<10){setLifecycleError('Provide an official reason of at least 10 characters.');return;}
    setLifecycleError('');setLoading(true);setMessage(null);
    try {
      const {data}=await api.post<{message:string;status:string}>('/api/ministry/lifecycle',{code:selected.trackingCode,action,reason});
      const displayStatus=data.status==='Verified'?'Approved':data.status as QueueItem['status'];
      const updated={...selected,status:displayStatus,remarks:reason,reviewedAt:new Date().toISOString()};
      setHistory(current=>current.map(item=>item.trackingCode===updated.trackingCode?updated:item));
      setSelected(updated);setLifecycleReason('');setMessage({text:data.message});
      await Promise.all([loadHistory(),loadStatistics(statisticsPeriod)]);
      requestAnimationFrame(()=>window.scrollTo({top:0,behavior:'smooth'}));
    } catch(error) {
      setMessage({error:true,text:getApiError(error,'The credential lifecycle could not be updated.')});
    } finally {setLoading(false);}
  };

  const updateHistoryQuery=(value:string)=>{
    setHistoryQuery(value);
    if(selected&&!matchesHistorySearch(selected,value))setSelected(null);
  };

  return <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
    <div className="flex flex-col justify-between gap-6 xl:flex-row xl:items-end">
      <div className="flex min-w-0 items-center gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-emerald-200 bg-emerald-50 text-[#02382c] shadow-sm">
          <ShieldCheck className="h-9 w-9" strokeWidth={1.7} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[.22em] text-emerald-700">Ministry workspace</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Credential review queue</h1>
          <p className="mt-2 text-slate-500">Audit and attest records submitted by accredited institutions.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 xl:justify-end">
        <label className="relative">
          <span className="sr-only">Statistics period</span>
          <select value={statisticsPeriod} onChange={event=>changeStatisticsPeriod(event.target.value as StatisticsPeriod)} className="appearance-none rounded-xl border border-slate-200 bg-white py-3 pl-4 pr-10 text-sm font-bold text-slate-700 shadow-sm outline-none transition hover:border-emerald-300 focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100">
            {statisticsPeriods.map(period=><option key={period.value} value={period.value}>{period.label}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-emerald-700" strokeWidth={2} aria-hidden="true"/>
        </label>
        <div className={`flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 transition-opacity ${statisticsLoading?'opacity-50':'opacity-100'}`}>
          <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-amber-100 px-2 text-lg font-black text-amber-800">{statistics.awaitingReview}</span>
          <span className="whitespace-nowrap text-sm font-bold text-amber-900">Awaiting review</span>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 transition-opacity ${statisticsLoading?'opacity-50':'opacity-100'}`}>
          <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-emerald-100 px-2 text-lg font-black text-emerald-700">{statistics.approved}</span>
          <span className="text-sm font-bold text-emerald-700">Approved</span>
        </div>
        <div className={`flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 transition-opacity ${statisticsLoading?'opacity-50':'opacity-100'}`}>
          <span className="grid h-9 min-w-9 place-items-center rounded-xl bg-red-100 px-2 text-lg font-black text-red-700">{statistics.rejected}</span>
          <span className="text-sm font-bold text-red-700">Rejected</span>
        </div>
      </div>
    </div>

    {message&&<div className={`mt-6 rounded-xl border px-5 py-4 text-sm font-bold ${message.error?'border-red-200 bg-red-50 text-red-700':'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message.text}</div>}

    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_390px]">
      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-5 sm:px-6">
          <h2 className="font-black">Incoming records</h2>
          <button type="button" onClick={refreshRecords} className="text-xs font-bold text-emerald-700">Refresh {recordsTab==='pending'?'queue':'history'}</button>
        </div>
        <div role="tablist" aria-label="Credential review records" className="flex gap-4 overflow-x-auto border-b border-slate-100 px-4 sm:gap-6 sm:px-6">
          <button type="button" role="tab" aria-selected={recordsTab==='pending'} onClick={()=>changeRecordsTab('pending')} className={`flex items-center gap-2 border-b-2 py-4 text-sm font-bold transition ${recordsTab==='pending'?'border-emerald-700 text-emerald-800':'border-transparent text-slate-500 hover:text-slate-800'}`}>
            Pending Queue
            <span className={`rounded-full px-2 py-0.5 text-xs font-black ${recordsTab==='pending'?'bg-emerald-100 text-emerald-800':'bg-slate-100 text-slate-600'}`}>{queue.length}</span>
          </button>
          <button type="button" role="tab" aria-selected={recordsTab==='history'} onClick={()=>changeRecordsTab('history')} className={`border-b-2 py-4 text-sm font-bold transition ${recordsTab==='history'?'border-emerald-700 text-emerald-800':'border-transparent text-slate-500 hover:text-slate-800'}`}>History</button>
        </div>

        {recordsTab==='history'&&<HistorySearch value={historyQuery} onChange={updateHistoryQuery} resultCount={filteredHistory.length} totalCount={history.length} />}

        {recordsTab==='pending'?(queue.length===0?<div className="px-6 py-20 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✓</div>
          <h3 className="mt-4 font-black">Queue is clear</h3>
          <p className="mt-1 text-sm text-slate-500">There are no credentials awaiting review.</p>
        </div>:<div className="divide-y divide-slate-100">{queue.map(item=><button key={item.trackingCode} type="button" onClick={()=>selectPending(item)} className={`grid w-full gap-3 border-l-4 px-5 py-5 text-left transition sm:grid-cols-[1fr_1fr_120px] ${selected?.trackingCode===item.trackingCode?'border-emerald-600 bg-emerald-50/70 ring-1 ring-inset ring-emerald-200':'border-transparent hover:bg-emerald-50/40'}`}>
          <div><p className="font-black text-slate-900">{item.studentName}</p><p className="mt-1 text-xs text-slate-500">{item.faculty} · {item.department}</p></div>
          <div><p className="text-sm font-bold text-slate-700">{item.universityName}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.submittedAt).toLocaleDateString()}</p></div>
          <code className="h-fit rounded-lg bg-slate-100 px-2 py-1 text-center text-xs font-black tracking-wider text-slate-700">{item.trackingCode}</code>
        </button>)}</div>):historyLoading&&!historyLoaded?<div className="px-6 py-20 text-center text-sm font-semibold text-slate-500">Loading processed records...</div>:history.length===0?<div className="px-6 py-20 text-center">
          <h3 className="font-black text-slate-800">No review history</h3>
          <p className="mt-1 text-sm text-slate-500">Approved and rejected credentials will appear here.</p>
        </div>:filteredHistory.length===0?<div className="px-6 py-20 text-center">
          <Search className="mx-auto h-9 w-9 text-slate-300" strokeWidth={1.5} aria-hidden="true"/>
          <h3 className="mt-4 font-black text-slate-800">No matching history records found.</h3>
          <p className="mt-1 text-sm text-slate-500">Try a different student, university, or archive code.</p>
        </div>:<div className="divide-y divide-slate-100">{filteredHistory.map(item=><button type="button" key={item.trackingCode} onClick={()=>selectHistory(item)} className={`grid w-full gap-3 border-l-4 px-5 py-5 text-left transition sm:grid-cols-[1fr_1fr_130px] ${selected?.trackingCode===item.trackingCode?'border-emerald-600 bg-emerald-50/70 ring-1 ring-inset ring-emerald-200':'border-transparent hover:bg-slate-50'}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2"><p className="font-black text-slate-900">{item.studentName}</p><span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${historyStatusClass(item.status)}`}>{item.status}</span></div>
            <p className="mt-1 text-xs text-slate-500">{item.faculty} · {item.department}</p>
            {item.status==='Rejected'&&<div className="mt-3 rounded-lg border border-red-100 bg-red-50/70 px-3 py-2 text-xs text-red-800"><span className="font-bold">Reason for rejection:</span> {item.remarks?.trim()||'No reason was provided.'}</div>}
          </div>
          <div><p className="text-sm font-bold text-slate-700">{item.universityName}</p><p className="mt-1 text-xs text-slate-400">Reviewed {new Date(item.reviewedAt||item.submittedAt).toLocaleDateString()}</p></div>
          <code className="h-fit rounded-lg bg-slate-100 px-2 py-1 text-center text-xs font-black tracking-wider text-slate-700">{item.trackingCode}</code>
        </button>)}</div>}
      </div>

      <aside className="h-fit rounded-3xl bg-slate-950 p-6 text-white shadow-xl lg:sticky lg:top-24">
        {recordsTab==='history'?(selected?<>
          <div className="flex items-center justify-between gap-3"><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Finalized audit record</p><span className={`rounded-full px-3 py-1 text-xs font-black ${historyStatusClass(selected.status)}`}>{selected.status}</span></div>
          <h2 className="mt-3 text-2xl font-black">{selected.studentName}</h2>
          <p className="mt-1 text-sm text-slate-400">{selected.universityName}</p>
          <dl className="mt-6 space-y-4 text-sm">{[['Department',selected.department],['Document type',selected.documentType],['GPA',selected.gpa],['Origin',selected.issuanceSystem]].map(([key,value])=><div key={key} className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="shrink-0 text-slate-400">{key}</dt><dd className="min-w-0 break-words text-right font-bold text-slate-100">{value}</dd></div>)}</dl>
          <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-slate-300">Official decision notes<textarea readOnly aria-readonly="true" value={selected.remarks?.trim()||'No official decision note was provided.'} rows={5} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm font-normal normal-case leading-6 tracking-normal text-slate-300 outline-none"/></label>
          <p className="mt-4 text-xs text-slate-500">This finalized decision is read-only.</p>
          {(selected.status==='Approved'||selected.status==='Suspended')&&<section className="mt-7 border-t border-white/10 pt-6">
            <h3 className="text-xs font-black uppercase tracking-[.18em] text-amber-300">Credential lifecycle control</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">Suspension is reversible. Revocation is permanent and cannot be undone.</p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-wide text-slate-300">Official lifecycle reason<textarea value={lifecycleReason} onChange={event=>{setLifecycleReason(event.target.value);if(event.target.value.trim().length>=10)setLifecycleError('');}} rows={3} aria-invalid={Boolean(lifecycleError)} className={`mt-2 w-full resize-none rounded-xl border bg-white/10 p-3 text-sm font-normal normal-case leading-6 tracking-normal text-white outline-none ${lifecycleError?'border-red-400':'border-white/15 focus:border-amber-400'}`} placeholder="Explain the legal or administrative basis..."/>{lifecycleError&&<span role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-300">{lifecycleError}</span>}</label>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {selected.status==='Approved'?<button type="button" disabled={loading} onClick={()=>void updateLifecycle('suspend')} className="rounded-xl border border-amber-300/40 bg-amber-400/10 px-3 py-3 text-sm font-black text-amber-200 hover:bg-amber-400/20 disabled:opacity-50">Suspend</button>:<button type="button" disabled={loading} onClick={()=>void updateLifecycle('reinstate')} className="rounded-xl border border-emerald-300/40 bg-emerald-400/10 px-3 py-3 text-sm font-black text-emerald-200 hover:bg-emerald-400/20 disabled:opacity-50">Reinstate</button>}
              <button type="button" disabled={loading} onClick={()=>void updateLifecycle('revoke')} className="rounded-xl border border-red-300/40 bg-red-500/10 px-3 py-3 text-sm font-black text-red-200 hover:bg-red-500/20 disabled:opacity-50">Revoke permanently</button>
            </div>
          </section>}
        </>:<div className="py-16 text-center">
          <ShieldCheck className="mx-auto h-12 w-12 text-emerald-400" strokeWidth={1.5} aria-hidden="true"/>
          <p className="mt-4 font-bold text-slate-200">Processed credential audit history</p>
          <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-slate-400">Select a processed record to view its finalized decision details.</p>
        </div>):!selected?<div className="py-16 text-center">
          <svg viewBox="0 0 24 24" className="mx-auto h-12 w-12 text-slate-600" fill="none" stroke="currentColor"><path d="M8 3h8l2 3v15H6V6l2-3Z"/><path d="M9 11h6M9 15h6"/></svg>
          <p className="mt-4 font-bold text-slate-300">Select a record to begin the audit</p>
        </div>:<>
          <p className="text-xs font-black uppercase tracking-[.2em] text-emerald-300">Decision panel</p>
          <h2 className="mt-3 text-2xl font-black">{selected.studentName}</h2>
          <dl className="mt-6 space-y-4 text-sm">{[['Tracking code',selected.trackingCode],['Father’s name',selected.fatherName],['University',selected.universityName],['Faculty',selected.faculty],['Department',selected.department],['Document',selected.documentType],['GPA',selected.gpa],['Origin',selected.issuanceSystem],...(selected.legacyMaktoubNumber?[['Maktoub',selected.legacyMaktoubNumber]]:[])].map(([key,value])=><div key={key} className="flex justify-between gap-4 border-b border-white/10 pb-3"><dt className="shrink-0 text-slate-400">{key}</dt><dd className="min-w-0 break-words text-right font-bold">{value}</dd></div>)}</dl>
          <label className="mt-6 block text-xs font-bold uppercase tracking-wide text-slate-300">Official decision notes<textarea value={remarks} onChange={event=>{setRemarks(event.target.value);if(event.target.value.trim())setRemarksError('');}} rows={4} aria-invalid={Boolean(remarksError)} aria-describedby={remarksError?'decision-notes-error':undefined} className={`mt-2 w-full resize-none rounded-xl border bg-white/10 p-3 text-sm font-normal normal-case tracking-normal text-white outline-none transition ${remarksError?'border-red-400 focus:border-red-300 focus:ring-4 focus:ring-red-500/15':'border-white/15 focus:border-emerald-400'}`} placeholder="Record the basis for this decision…"/>{remarksError&&<span id="decision-notes-error" role="alert" className="mt-2 block text-xs font-semibold normal-case tracking-normal text-red-300">{remarksError}</span>}</label>
          <div className="mt-5 grid grid-cols-3 gap-2">
            <button type="button" disabled={loading} onClick={()=>{setSelected(null);setRemarks('');setRemarksError('');}} className="rounded-xl border border-slate-500 bg-white/5 px-2 py-3 text-sm font-black text-slate-200 hover:bg-white/10">Cancel</button>
            <button disabled={loading} onClick={()=>void review('reject')} className="rounded-xl border border-red-400/40 bg-red-500/10 px-2 py-3 text-sm font-black text-red-300 hover:bg-red-500/20">Reject</button>
            <button disabled={loading} onClick={()=>void review('verify')} className="rounded-xl bg-emerald-400 px-2 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-300">{loading?'Saving…':'Approve'}</button>
          </div>
        </>}
      </aside>
    </div>
  </section>;
}
