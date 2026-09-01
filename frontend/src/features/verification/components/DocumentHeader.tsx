import type { CertificateData } from '../../../types';
import { MinistryLogo, UniversityLogo } from './CredentialLogos';

export default function DocumentHeader({ data }: { data: CertificateData }) {
  const verified = data.status === 'Verified';
  const danger = ['Rejected','Revoked','Superseded','Cancelled'].includes(data.status);
  return <div className="border-b border-slate-200 pb-6">
    <div className="grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 sm:grid-cols-[80px_minmax(0,1fr)_80px] sm:gap-6">
      <MinistryLogo className="h-12 w-12 bg-transparent object-contain sm:h-20 sm:w-20"/>
      <div className="min-w-0 text-center"><p className="text-[9px] font-black uppercase tracking-[.12em] text-emerald-700 sm:text-[10px] sm:tracking-[.25em]">Ministry of Higher Education</p><h2 className="mt-2 font-serif text-lg font-black leading-tight text-slate-950 sm:text-2xl">Official Academic Record</h2><p className="mt-1 break-words text-xs font-semibold text-slate-600 sm:text-sm">{data.university.nameEnglish}</p></div>
      <UniversityLogo code={data.university.code} name={data.university.nameEnglish} className="h-12 w-12 object-contain sm:h-20 sm:w-20"/>
    </div>
    <div className="mt-5 flex justify-center"><span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-extrabold ${verified?'bg-emerald-100 text-emerald-800':danger?'bg-red-100 text-red-700':'bg-amber-100 text-amber-800'}`}><span className="h-2 w-2 rounded-full bg-current"/>{data.status}</span></div>
    <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3"><div><span className="block text-xs text-slate-500">Verification code</span><strong className="font-mono tracking-widest">{data.verificationCode}</strong></div><div><span className="block text-xs text-slate-500">Issued</span><strong>{new Date(data.issuedAt).toLocaleDateString('en-GB')}</strong></div><div><span className="block text-xs text-slate-500">Record type</span><strong>{data.documentType ?? 'Protected'}</strong></div></div>
  </div>;
}
