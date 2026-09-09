import { useEffect, useState } from 'react';
import { CheckCircle2, Clock3, FileCheck2, FilePlus2, History, LayoutDashboard, ShieldCheck, XCircle } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { api, getApiError, readSession } from '../../lib/api';

interface MinistryStatistics {
  awaitingReview:number;
  approved:number;
  rejected:number;
}

interface UniversityRecord {
  status:string;
}

interface Metric {
  label:string;
  value:number;
  icon:typeof Clock3;
  tone:string;
}

export default function WorkspaceDashboard() {
  const [session]=useState(()=>readSession());
  const [metrics,setMetrics]=useState<Metric[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');

  useEffect(()=>{
    if(!session||(session.role!=='Ministry'&&session.role!=='University'))return;
    let active=true;
    const load=async()=>{
      try {
        if(session.role==='Ministry'){
          const {data}=await api.get<MinistryStatistics>('/api/ministry/statistics',{params:{period:'year'}});
          if(active)setMetrics([
            {label:'Awaiting review',value:data.awaitingReview,icon:Clock3,tone:'border-amber-200 bg-amber-50 text-amber-800'},
            {label:'Approved',value:data.approved,icon:CheckCircle2,tone:'border-emerald-200 bg-emerald-50 text-emerald-800'},
            {label:'Rejected',value:data.rejected,icon:XCircle,tone:'border-red-200 bg-red-50 text-red-700'},
          ]);
        }else{
          const {data}=await api.get<UniversityRecord[]>('/api/certificates/issued');
          if(active)setMetrics([
            {label:'Total records',value:data.length,icon:FileCheck2,tone:'border-slate-200 bg-white text-slate-800'},
            {label:'Awaiting review',value:data.filter(item=>item.status==='PendingMinistry').length,icon:Clock3,tone:'border-amber-200 bg-amber-50 text-amber-800'},
            {label:'Approved',value:data.filter(item=>item.status==='Verified').length,icon:CheckCircle2,tone:'border-emerald-200 bg-emerald-50 text-emerald-800'},
          ]);
        }
      }catch(requestError){if(active)setError(getApiError(requestError,'Dashboard statistics could not be loaded.'));}
      finally{if(active)setLoading(false);}
    };
    void load();
    return()=>{active=false;};
  },[session]);

  if(!session||(session.role!=='Ministry'&&session.role!=='University'))return <Navigate to="/login" replace/>;
  const ministry=session.role==='Ministry';
  const actions=ministry
    ?[{to:'/ministry/review',title:'Review queue',description:'Review pending credentials and record official decisions.',icon:ShieldCheck},{to:'/ministry/review?tab=history',title:'Review history',description:'Audit processed credentials and lifecycle actions.',icon:History}]
    :[{to:'/university/issue',title:'Issue credential',description:'Register and securely submit a new academic credential.',icon:FilePlus2},{to:'/university/records',title:'Issued records',description:'Review credentials issued by your assigned university.',icon:FileCheck2}];

  return <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
    <header className="av-card av-card-pad flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.2em] text-emerald-700">{ministry?'Ministry workspace':'University workspace'}</p><h1 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Dashboard</h1><p className="mt-2 text-sm leading-6 text-slate-500">{ministry?'Monitor credential review activity and continue official attestations.':`Manage academic credentials for ${session.universityName||'your assigned university'}.`}</p></div><span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-[#02382c]"><LayoutDashboard className="h-8 w-8" aria-hidden="true"/></span></header>
    {error&&<p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">{error}</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-3" aria-label="Workspace statistics">{loading?Array.from({length:3},(_,index)=><div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"/>):metrics.map(({label,value,icon:Icon,tone})=><article key={label} className={`rounded-2xl border p-5 shadow-sm ${tone}`}><div className="flex items-center justify-between gap-4"><div><p className="text-sm font-bold">{label}</p><p className="mt-3 text-3xl font-black">{value}</p></div><Icon className="h-8 w-8 opacity-70" aria-hidden="true"/></div></article>)}</div>
    <div className="mt-6 grid gap-5 md:grid-cols-2">{actions.map(({to,title,description,icon:Icon})=><Link key={title} to={to} className="av-card av-card-interactive av-card-pad group min-h-44"><span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#02382c] transition group-hover:bg-[#02382c] group-hover:text-white"><Icon className="h-6 w-6" aria-hidden="true"/></span><h2 className="av-card-title mt-5 text-lg">{title}</h2><p className="av-card-copy mt-2 text-sm">{description}</p></Link>)}</div>
  </section>;
}
