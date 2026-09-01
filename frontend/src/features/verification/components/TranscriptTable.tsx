import type { Grade, VerifiedCertificateData } from '../../../types';
import { MinistryLogo, UniversityLogo } from './CredentialLogos';

const creditsOf = (grade: Grade) => {
  const parsed = Number.parseFloat(grade.creditHours);
  return Number.isFinite(parsed) ? parsed : 0;
};

export default function TranscriptTable({ data }: { data: VerifiedCertificateData }) {
  const groups = data.transcript.reduce<Map<number, Grade[]>>((map, grade) => {
    map.set(grade.semesterNumber, [...(map.get(grade.semesterNumber) ?? []), grade]);
    return map;
  }, new Map());
  const totalCredits = data.transcript.reduce((sum, grade) => sum + creditsOf(grade), 0);
  const weightedAverage = totalCredits
    ? data.transcript.reduce((sum, grade) => sum + grade.score * creditsOf(grade), 0) / totalCredits
    : 0;

  return <div className="credential-transcript mx-auto w-full rounded-lg bg-gray-50 p-1 sm:p-3">
    <div className="credential-transcript-paper relative w-full overflow-hidden rounded-lg bg-white p-3 shadow-md sm:p-6">
    <div className="pointer-events-none absolute inset-0 grid place-items-center overflow-hidden opacity-[.035]"><span className="-rotate-12 text-[5rem] font-black uppercase tracking-[.2em] text-emerald-950 sm:text-[8rem]">MOHE</span></div>
    <header className="relative border-b-2 border-emerald-900 px-12 pb-6 text-center sm:px-20">
      <MinistryLogo className="absolute left-0 top-1/2 h-12 w-12 -translate-y-1/2 bg-transparent object-contain sm:h-20 sm:w-20"/>
      <UniversityLogo code={data.university.code} name={data.university.nameEnglish} className="absolute right-0 top-1/2 h-12 w-12 -translate-y-1/2 object-contain sm:h-20 sm:w-20"/>
      <p className="text-[10px] font-black uppercase tracking-[.3em] text-emerald-800">Islamic Emirate of Afghanistan</p>
      <h3 className="mt-2 font-serif text-lg font-black leading-tight text-emerald-950 sm:text-3xl">Official Academic Transcript</h3>
      <p className="mt-2 text-xs font-bold uppercase tracking-[.18em] text-slate-600">Ministry of Higher Education · National Academic Registry</p>
      <div className="mx-auto mt-4 h-[5px] w-24 bg-gradient-to-r from-transparent via-amber-600 to-transparent" />
    </header>
    <dl className="relative mt-6 grid gap-x-8 gap-y-3 rounded-xl border border-emerald-900/20 bg-white/60 p-4 text-sm sm:grid-cols-2">
      {[['Student',data.studentName],['University',data.university.nameEnglish],['Faculty',data.faculty],['Department',data.department],['Graduation year',String(data.graduationYear)],['Registry code',data.verificationCode]].map(([key,value])=><div key={key} className="flex justify-between gap-4 border-b border-emerald-950/10 pb-2"><dt className="text-xs font-bold uppercase tracking-wide text-slate-500">{key}</dt><dd className="text-right font-bold text-slate-900">{value}</dd></div>)}
    </dl>
    {!data.transcript.length ? <div className="relative my-8 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">No transcript courses are attached to this record.</div> :
      <div className="semester-grid relative mt-7 grid w-full grid-cols-1 gap-6 md:grid-cols-2">{Array.from(groups.entries()).sort(([a],[b])=>a-b).map(([semester,grades])=>{
        const semesterCredits=grades.reduce((sum,grade)=>sum+creditsOf(grade),0);
        const semesterAverage=semesterCredits?grades.reduce((sum,grade)=>sum+grade.score*creditsOf(grade),0)/semesterCredits:0;
        return <section key={semester} className="break-inside-avoid overflow-hidden rounded-xl border border-emerald-950/30 bg-white/80">
          <div className="flex items-center justify-between bg-emerald-950 px-4 py-2.5 text-white"><h4 className="font-serif text-sm font-black uppercase tracking-wider">Semester {semester}</h4><span className="text-[11px] font-bold text-emerald-200">{semesterCredits} credit hours</span></div>
          <div className="w-full overflow-hidden"><table className="w-full table-fixed text-left text-xs sm:text-sm"><thead><tr className="border-b border-emerald-950/20 bg-amber-50/70 text-[9px] uppercase tracking-[.04em] text-slate-600 sm:text-[10px] sm:tracking-[.08em]"><th className="w-8 px-1 py-3 text-center sm:w-12 sm:px-2">No.</th><th className="px-2 py-3 sm:px-3">Course title</th><th className="w-12 whitespace-nowrap px-1 py-3 text-center sm:w-16">Credits</th><th className="w-16 whitespace-nowrap px-1 py-3 text-center sm:w-24 sm:py-3 sm:pl-2 sm:pr-4"><span className="sm:hidden">Score</span><span className="hidden sm:inline">Score / 100</span></th></tr></thead><tbody className="divide-y divide-slate-200">{grades.map((grade,index)=><tr key={`${semester}-${grade.subjectName}-${index}`}><td className="w-8 px-1 py-3 text-center text-slate-500 sm:w-12 sm:px-2">{index+1}</td><td className="break-words px-2 py-3 font-semibold leading-5 text-slate-900 sm:px-3">{grade.subjectName}</td><td className="w-12 px-1 py-3 text-center font-mono tabular-nums sm:w-16">{grade.creditHours}</td><td className="w-16 px-1 py-3 text-center font-black tabular-nums text-emerald-800 sm:w-24 sm:pl-2 sm:pr-4">{grade.score}</td></tr>)}</tbody><tfoot><tr className="border-t border-emerald-950/20 bg-emerald-50/60 text-[10px] font-black sm:text-xs"><td colSpan={2} className="px-2 py-3 text-right uppercase tracking-wide sm:px-3">Semester summary</td><td className="w-12 px-1 py-3 text-center tabular-nums sm:w-16">{semesterCredits}</td><td className="w-16 px-1 py-3 text-center tabular-nums sm:w-24 sm:pl-2 sm:pr-4">{semesterAverage.toFixed(1)}%</td></tr></tfoot></table></div>
        </section>;
      })}</div>}
      <footer className="relative mt-8 grid gap-4 border-t-2 border-emerald-900 pt-5 sm:grid-cols-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Total credits earned</p><p className="mt-1 text-xl font-black text-emerald-950">{totalCredits}</p></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Weighted average</p><p className="mt-1 text-xl font-black text-emerald-950">{weightedAverage.toFixed(1)}%</p></div><div className="sm:text-right"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Cumulative GPA</p><p className="mt-1 text-xl font-black text-emerald-950">{data.gpa}</p></div></footer>
    </div>
  </div>;
}
