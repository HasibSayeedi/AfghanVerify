import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RecordsPaginationProps {
  page:number;
  totalPages:number;
  onChange:(page:number)=>void;
}

export default function RecordsPagination({page,totalPages,onChange}:RecordsPaginationProps) {
  if(totalPages<=1)return null;
  const first=Math.max(1,Math.min(page-2,totalPages-4));
  const last=Math.min(totalPages,first+4);
  const pages=Array.from({length:last-first+1},(_,index)=>first+index);
  return <nav aria-label="Records pagination" className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-4 sm:flex-row sm:px-6">
    <p className="text-xs font-semibold text-slate-500">Page {page} of {totalPages}</p>
    <div className="flex items-center gap-1">
      <button type="button" disabled={page===1} onClick={()=>onChange(page-1)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Previous page"><ChevronLeft className="h-4 w-4" aria-hidden="true"/></button>
      {pages.map(number=><button type="button" key={number} onClick={()=>onChange(number)} aria-current={number===page?'page':undefined} className={`h-10 min-w-10 rounded-lg px-3 text-sm font-bold transition ${number===page?'bg-[#02382c] text-white':'border border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800'}`}>{number}</button>)}
      <button type="button" disabled={page===totalPages} onClick={()=>onChange(page+1)} className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-600 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-40" aria-label="Next page"><ChevronRight className="h-4 w-4" aria-hidden="true"/></button>
    </div>
  </nav>;
}
