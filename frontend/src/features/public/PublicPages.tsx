import { Award, Building2, CheckCircle2, FileCheck2, GraduationCap, HelpCircle, QrCode, Search, ShieldCheck, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';

const primaryAction = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#02382c] px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-emerald-900 focus:outline-none focus-visible:ring-4 focus-visible:ring-emerald-200';

export function HomePage() {
  return <div className="bg-slate-50">
    <section className="relative overflow-hidden bg-[#022f27] py-20 text-white sm:py-28">
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true"/>
      <div className="absolute -bottom-32 -left-24 h-80 w-80 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true"/>
      <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_.9fr] lg:px-8">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[.2em] text-emerald-200"><ShieldCheck className="h-4 w-4"/>National credential registry</p>
          <h1 className="mt-7 text-4xl font-black tracking-tight sm:text-6xl">Academic credentials you can trust.</h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-emerald-50/75 sm:text-lg">AfghanVerify connects university-issued academic records with Ministry review and a secure public verification experience.</p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row"><Link to="/verify" className={`${primaryAction} bg-amber-500 text-slate-950 hover:bg-amber-400`}><Search className="h-5 w-5"/>Verify a Credential</Link><Link to="/how-it-works" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-white/20 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10">See how it works</Link></div>
        </div>
        <div className="relative mx-auto w-full max-w-md lg:mx-0 lg:justify-self-end" aria-hidden="true">
          <div className="rounded-[2rem] border border-white/15 bg-white/10 p-5 shadow-2xl backdrop-blur"><div className="rounded-2xl bg-white p-6 text-slate-900"><div className="flex items-center justify-between"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><GraduationCap className="h-7 w-7"/></span><span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"><CheckCircle2 className="h-4 w-4"/>Verified</span></div><div className="mt-8 h-3 w-2/3 rounded bg-slate-200"/><div className="mt-3 h-2.5 w-full rounded bg-slate-100"/><div className="mt-2 h-2.5 w-4/5 rounded bg-slate-100"/><div className="mt-8 flex items-end justify-between border-t border-slate-100 pt-5"><div><div className="h-2.5 w-24 rounded bg-slate-200"/><div className="mt-2 h-2 w-32 rounded bg-slate-100"/></div><QrCode className="h-16 w-16 text-[#02382c]"/></div></div></div>
        </div>
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8"><div className="grid auto-rows-fr gap-6 md:grid-cols-3">{[
      [Building2, 'Institutional issuance', 'Authorized university staff submit student and academic information within their assigned university scope.'],
      [FileCheck2, 'Ministry review', 'Submitted credentials enter a controlled review workflow before their public status is finalized.'],
      [ShieldCheck, 'Secure verification', 'A unique verification code or QR code opens the public credential record and its integrity status.'],
    ].map(([Icon, title, text]) => <article key={String(title)} className="av-card av-card-pad flex h-full min-h-64 flex-col items-center text-center"><span className="grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon className="h-8 w-8"/></span><h2 className="av-card-title mt-5 text-lg">{String(title)}</h2><p className="av-card-copy mt-3 text-sm">{String(text)}</p></article>)}</div></section>
  </div>;
}

export function HowItWorksPage() {
  const steps = [
    [Building2, 'University', 'Authorized university staff work only within their assigned institution.'],
    [UsersRound, 'Student academic record', 'Identity, programme, document and transcript information are submitted as one credential record.'],
    [FileCheck2, 'Ministry review', 'A Ministry reviewer approves or rejects the submitted record and can include official decision notes.'],
    [Award, 'Credential issuance', 'The system assigns a university-prefixed verification code and produces a QR-ready credential.'],
    [Search, 'Public verification', 'Anyone can enter the code or scan its QR code to view the published verification result.'],
  ];
  return <PublicPageHeader eyebrow="Transparent workflow" title="How AfghanVerify works" description="A clear path from institutional submission to public verification.">
    <ol className="relative mt-10 grid auto-rows-fr gap-5 lg:grid-cols-5">{steps.map(([Icon, title, text], index) => <li key={String(title)} className="av-card av-card-pad relative flex h-full min-h-64 flex-col items-center text-center"><span className="text-xs font-black tracking-widest text-amber-600">STEP {index + 1}</span><span className="mt-5 grid h-16 w-16 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><Icon className="h-8 w-8"/></span><h2 className="av-card-title mt-5">{String(title)}</h2><p className="av-card-copy mt-3 text-sm">{String(text)}</p></li>)}</ol>
    <div className="mt-10 text-center"><Link to="/verify" className={primaryAction}><Search className="h-5 w-5"/>Verify a Credential</Link></div>
  </PublicPageHeader>;
}

export function AboutPage() {
  return <PublicPageHeader eyebrow="About the platform" title="A clearer way to confirm academic records" description="AfghanVerify is a digital credential registry for the university, Ministry and public verification workflows implemented by this platform.">
    <div className="mt-10 grid auto-rows-fr gap-6 md:grid-cols-2 xl:grid-cols-3">
      <article className="av-card flex min-h-72 flex-col items-center justify-center p-6 text-center sm:p-8"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><ShieldCheck className="h-8 w-8"/></span><h2 className="av-card-title mt-5 text-xl">The problem it addresses</h2><p className="av-card-copy mt-3">Academic records can be difficult to validate when information is fragmented or depends on manual confirmation. AfghanVerify gives an authorized issuing and review workflow a consistent public result.</p></article>
      <article className="av-card flex min-h-72 flex-col items-center justify-center p-6 text-center sm:p-8"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-800"><UsersRound className="h-8 w-8"/></span><h2 className="av-card-title mt-5 text-xl">Who uses it</h2><p className="av-card-copy mt-3">University registrars submit records, university administrators manage scoped staff, Ministry reviewers process credentials, Super Administrators manage platform institutions, and the public verifies issued records.</p></article>
      <article className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-[#02382c] p-6 text-center text-white shadow-sm md:col-span-2 sm:p-8 xl:col-span-1"><span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-white/10 text-amber-400"><Award className="h-8 w-8"/></span><h2 className="mt-5 text-xl font-bold tracking-tight">The objective</h2><p className="mt-3 leading-7 text-emerald-50/80">Provide a secure, traceable and accessible way to verify academic credential information while preserving institutional scope and administrative accountability.</p></article>
    </div>
  </PublicPageHeader>;
}

export function FaqPage() {
  const questions = [
    ['What is AfghanVerify?', 'AfghanVerify is the academic credential registry and verification platform described on this website. It supports university submission, Ministry review and public verification.'],
    ['How do I verify a credential?', 'Open Verify, enter the complete verification code printed on the credential, and submit the search. The system will show the available public verification result.'],
    ['Can I use a QR code?', 'Yes. A credential QR code opens its verification address. The Verify page also provides a scanner when browser camera access is available.'],
    ['What if a credential is not found?', 'Check every character in the code and try again. If it still cannot be found, contact the university that issued the academic document.'],
    ['Who can use the internal system?', 'Only authenticated staff with an assigned system role can access internal university, Ministry or administration workspaces.'],
    ['What if the credential information is incorrect?', 'Contact the issuing university. Authorized university staff can correct eligible pending records; finalized decisions remain part of the controlled review workflow.'],
  ];
  return <PublicPageHeader eyebrow="Help centre" title="Frequently asked questions" description="Practical answers about credential search and the AfghanVerify workflow.">
    <div className="mx-auto mt-10 max-w-3xl space-y-3">{questions.map(([question, answer]) => <details key={question} className="av-card av-card-interactive group overflow-hidden"><summary className="av-card-title flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-emerald-100"><span>{question}</span><HelpCircle className="h-5 w-5 shrink-0 text-emerald-700 transition group-open:rotate-45"/></summary><p className="av-card-copy border-t border-slate-100 px-5 py-4 text-sm">{answer}</p></details>)}</div>
  </PublicPageHeader>;
}

function PublicPageHeader({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children: React.ReactNode }) {
  return <section className="min-h-[calc(100vh-9rem)] bg-slate-50 px-4 py-14 sm:px-6 sm:py-20 lg:px-8"><div className="mx-auto max-w-7xl"><header className="mx-auto max-w-3xl text-center"><p className="text-xs font-bold uppercase tracking-[.22em] text-emerald-700">{eyebrow}</p><h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-5xl">{title}</h1><p className="mt-5 text-base leading-8 text-slate-600 sm:text-lg">{description}</p></header>{children}</div></section>;
}
