import { QRCodeSVG } from 'qrcode.react';
import { publicVerifyBaseUrl } from '../../../lib/api';
import type { VerifiedCertificateData } from '../../../types';
import { MinistryLogo, UniversityLogo } from './CredentialLogos';

export default function OfficialDiploma({ data }: { data: VerifiedCertificateData }) {
  const verifyUrl = `${publicVerifyBaseUrl}/verify/${encodeURIComponent(data.verificationCode)}`;
  return <div className="credential-diploma w-full rounded-2xl bg-gray-50 p-1 sm:p-6">
    <div className="credential-diploma-paper overflow-hidden rounded-2xl bg-white p-1 text-center shadow-xl sm:p-5">
    <div className="relative overflow-hidden rounded-2xl border border-amber-600/50 px-2 pb-8 pt-5 sm:px-7 sm:pb-12 sm:pt-10">
    <div className="pointer-events-none absolute inset-0 grid place-items-center text-[8rem] font-black text-emerald-950 opacity-[.035] sm:text-[13rem]">MOHE</div>
    <header className="relative grid grid-cols-[48px_minmax(0,1fr)_48px] items-center gap-2 sm:grid-cols-[80px_minmax(0,1fr)_80px] sm:gap-4">
      <MinistryLogo className="h-12 w-12 bg-transparent object-contain sm:h-20 sm:w-20"/>
      <div className="min-w-0"><p className="text-[8px] font-black uppercase tracking-[.12em] text-emerald-800 sm:text-[9px] sm:tracking-[.3em]">Islamic Emirate of Afghanistan</p><h3 className="mt-2 font-serif text-base font-black uppercase leading-tight text-emerald-950 sm:text-3xl">Ministry of Higher Education</h3><p className="mt-2 text-[10px] font-bold uppercase tracking-[.1em] text-slate-600 sm:text-xs sm:tracking-[.18em]">Official National Diploma</p><div className="mx-auto mt-4 h-px w-20 bg-amber-600 sm:w-32"/></div>
      <UniversityLogo code={data.university.code} name={data.university.nameEnglish} className="h-12 w-12 object-contain sm:h-20 sm:w-20"/>
    </header>
    <main className="relative mt-9"><p className="font-serif text-sm font-medium italic text-slate-800">This official diploma certifies that</p><h1 className="mt-3 font-serif text-3xl font-bold tracking-wide text-emerald-950 sm:text-5xl">{data.studentName}</h1><p className="mx-auto mt-5 max-w-2xl font-serif text-sm font-medium leading-7 text-slate-800 sm:text-base">has fulfilled all academic requirements of the <strong className="font-bold">{data.faculty}</strong>, Department of <strong>{data.department}</strong>, at <strong>{data.university.nameEnglish}</strong>, and is awarded this nationally registered academic credential.</p><div className="mx-auto mt-6 inline-flex rounded-full border border-amber-600/40 bg-amber-50 px-6 py-2 font-serif text-sm font-black uppercase tracking-widest text-emerald-950">Graduating class of {data.graduationYear}</div></main>
    <footer className="relative mt-10 grid items-end gap-7 border-t border-emerald-950/25 pt-6 sm:grid-cols-[1fr_auto_1fr]"><div className="text-left"><div className="mb-2 h-px bg-slate-500"/><p className="text-[10px] font-black uppercase tracking-wider">University Registrar</p><p className="mt-1 text-xs text-slate-500">Authorized institutional signature</p></div><div className="mx-auto rounded-xl border border-emerald-900/30 bg-white p-2"><QRCodeSVG value={verifyUrl} size={104} level="H" fgColor="#064e3b"/><code className="mt-1 block text-[10px] font-black tracking-wider">{data.verificationCode}</code></div><div className="text-right"><div className="mb-2 h-px bg-slate-500"/><p className="text-[10px] font-black uppercase tracking-wider">Ministry Attestation</p><p className="mt-1 text-xs text-slate-500">Status: {data.status}</p></div></footer>
    </div>
    </div>
  </div>;
}
