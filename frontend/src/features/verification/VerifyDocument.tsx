import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import DocumentHeader from './components/DocumentHeader';
import StudentProfile from './components/StudentProfile';
import TranscriptTable from './components/TranscriptTable';
import OfficialDiploma from './components/OfficialDiploma';
import { useVerifyDocument } from './hooks/useVerifyDocument';

const QrScanner = lazy(() => import('./components/QrScanner'));
const CURRENT_CREDENTIAL_CODE_PATTERN = /^[A-Z]{2,4}-\d{9}$/;
const MIN_CREDENTIAL_CODE_LENGTH = 12;
const MAX_CREDENTIAL_CODE_LENGTH = 14;

export default function VerifyDocument() {
  const { token } = useParams(); const navigate = useNavigate();
  const { code, setCode, result, error, loading, showScanner, setShowScanner, verify } = useVerifyDocument();
  const [codeError, setCodeError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview'|'transcript'|'diploma'>('overview'); const [downloading, setDownloading] = useState(false); const [downloadError, setDownloadError] = useState('');
  const resultRef = useRef<HTMLElement>(null);
  const activeDocumentRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (token) void verify(token); }, [token, verify]);
  useEffect(() => { if (result) requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }, [result]);
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalized = code.trim().toUpperCase();
    if (!normalized) {
      setCodeError('Archive code is required.');
      return;
    }
    if (normalized.length < MIN_CREDENTIAL_CODE_LENGTH || normalized.length > MAX_CREDENTIAL_CODE_LENGTH) {
      setCodeError('Archive code must contain a 2-4 letter prefix and exactly 9 digits.');
      return;
    }
    if (!CURRENT_CREDENTIAL_CODE_PATTERN.test(normalized)) {
      setCodeError('Enter a valid archive code, e.g. KU-491029481.');
      return;
    }
    setCodeError('');
    navigate(`/verify/${encodeURIComponent(normalized)}`);
    void verify(normalized);
  };
  const download = async () => {
    if (!result || !result.detailsAvailable || activeTab === 'overview') return;
    const activeView = activeDocumentRef.current;
    const targetSelector = activeTab === 'diploma' ? '.credential-diploma-paper' : activeTab === 'transcript' ? '.credential-transcript-paper' : '.credential-overview-paper';
    const documentElement = activeView?.querySelector<HTMLElement>(targetSelector) ?? null;
    if (!documentElement) { setDownloadError('The active credential view could not be found. Please reload the page and try again.');return; }
    setDownloading(true);setDownloadError('');
    const originalInlineStyle = documentElement.getAttribute('style');
    try {
      if (activeTab === 'diploma') {
        Object.assign(documentElement.style,{width:'11.23in',height:'7.94in',minWidth:'11.23in',maxWidth:'11.23in',boxSizing:'border-box',backgroundColor:'#ffffff',margin:'0',border:'none',outline:'none',boxShadow:'none'});
        await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));
      }
      await document.fonts.ready;
      const [{default:html2canvas},{jsPDF}] = await Promise.all([import('html2canvas-pro'),import('jspdf')]);
      const canvas = await html2canvas(documentElement,{scale:4,useCORS:true,backgroundColor:'#ffffff',logging:false,imageSmoothing:true,imageSmoothingQuality:'high',windowWidth:Math.max(window.innerWidth,documentElement.scrollWidth),windowHeight:Math.max(window.innerHeight,documentElement.scrollHeight)});
      const isDiploma = activeTab === 'diploma';
      const orientation = isDiploma ? 'landscape' : 'portrait';
      const a4Format: [number,number] = isDiploma ? [11.69,8.27] : [8.27,11.69];
      const pdf = new jsPDF({unit:'in',format:a4Format,orientation});
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 0;
      const fitScale = Math.min((pageWidth-margin*2)/canvas.width,(pageHeight-margin*2)/canvas.height);
      const renderedWidth = canvas.width*fitScale;
      const renderedHeight = canvas.height*fitScale;
      pdf.addImage(canvas,'PNG',(pageWidth-renderedWidth)/2,(pageHeight-renderedHeight)/2,renderedWidth,renderedHeight,undefined,'SLOW');
      const documentName = activeTab === 'diploma' ? 'Diploma' : activeTab === 'transcript' ? 'Transcript' : 'Credential';
      pdf.save(`AfghanVerify-${result.verificationCode}-${documentName}.pdf`);
    } catch(error) {
      console.error('Credential PDF generation failed.',error);
      setDownloadError('The PDF could not be generated. Please verify that all document images are accessible and try again.');
    } finally {
      if (originalInlineStyle===null) documentElement.removeAttribute('style'); else documentElement.setAttribute('style',originalInlineStyle);
      setDownloading(false);
    }
  };
  const activeAttachment = !result?.detailsAvailable ? null
    : activeTab === 'diploma' && result.diplomaFileUrl ? { href:result.diplomaFileUrl, label:'View original uploaded diploma' }
      : activeTab === 'transcript' && result.transcriptFileUrl ? { href:result.transcriptFileUrl, label:'View original uploaded transcript' }
        : null;
  return <>
    <section className="relative isolate overflow-hidden bg-emerald-950 px-4 pb-24 pt-16 text-white sm:pt-24 print:hidden">
      <div className="absolute inset-0 -z-10 opacity-25 [background-image:radial-gradient(circle_at_20%_10%,#34d399,transparent_28%),radial-gradient(circle_at_80%_80%,#0f766e,transparent_35%)]" />
      <div className="mx-auto max-w-4xl text-center animate-rise"><div className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-4 py-2 text-xs font-bold text-emerald-200"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />Official national verification service</div>
        <h1 className="text-4xl font-black tracking-tight sm:text-6xl">Trust every credential.<br/><span className="text-emerald-300">Verify in seconds.</span></h1>
        <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-emerald-100/75 sm:text-lg">Confirm diplomas and transcripts issued by accredited Afghan universities through the Ministry of Higher Education registry.</p>
        <form noValidate onSubmit={submit} className="mx-auto mt-9 max-w-2xl rounded-2xl bg-white p-2 shadow-2xl shadow-black/25">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="code">Verification code</label>
            <div className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl border px-3 transition focus-within:ring-4 ${codeError ? 'border-red-500 focus-within:border-red-500 focus-within:ring-red-100' : 'border-transparent focus-within:border-emerald-600 focus-within:ring-emerald-100'}`}>
              <svg viewBox="0 0 24 24" className={`h-5 w-5 shrink-0 ${codeError ? 'text-red-500' : 'text-slate-400'}`} fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 4 4"/></svg>
              <input
                id="code"
                value={code}
                onChange={event => {
                  const value = event.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase();
                  setCode(value);
                  if (codeError) setCodeError('');
                }}
                maxLength={14}
                placeholder="Enter code, e.g. KU-491029481"
                aria-invalid={Boolean(codeError)}
                aria-describedby={codeError ? 'credential-code-error' : undefined}
                className="min-w-0 flex-1 bg-transparent py-3 font-mono text-base font-bold tracking-widest text-slate-900 outline-none placeholder:font-sans placeholder:font-normal placeholder:tracking-normal"
              />
            </div>
            <button disabled={loading} className="rounded-xl bg-emerald-700 px-6 py-3.5 font-bold text-white transition hover:bg-emerald-800 disabled:opacity-60">{loading ? 'Checking...' : 'Verify record'}</button>
          </div>
          {codeError && <p id="credential-code-error" role="alert" className="px-3 pb-2 pt-2 text-left text-xs font-semibold text-red-600">{codeError}</p>}
        </form>
        <button onClick={()=>setShowScanner(v=>!v)} className="mt-5 text-sm font-bold text-emerald-200 hover:text-white">{showScanner?'Close camera':'Scan a credential QR code →'}</button>
        {showScanner && <div className="mx-auto mt-6 max-w-sm animate-rise"><Suspense fallback={<div className="aspect-square animate-pulse rounded-2xl bg-emerald-900" />}><QrScanner onScanSuccess={(value)=>{setShowScanner(false); void verify(value);}} /></Suspense></div>}
      </div>
    </section>
    <section className="print-shell relative z-10 mx-auto -mt-12 min-h-40 max-w-5xl px-4 pb-20 sm:px-6">
      {error && <div role="alert" className="animate-rise rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xl"><p className="font-bold text-red-700">Verification unsuccessful</p><p className="mt-1 text-sm text-slate-500">{error}</p></div>}
      {!result && !error && <div className="grid gap-4 sm:grid-cols-3">{[['01','Enter the archive code'],['02','We check the registry'],['03','View the verified record']].map(([n,t])=><div key={n} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><span className="text-xs font-black text-emerald-700">{n}</span><p className="mt-3 font-bold text-slate-800">{t}</p></div>)}</div>}
      {result && <article ref={resultRef} className="print-document scroll-mt-6 animate-rise overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-900/10"><div className="print-document-body p-3 sm:p-9"><DocumentHeader data={result} />
        {!result.signatureValid && result.signatureVersion >= 2 && <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">Security warning: this record’s signature does not match its stored data.</div>}
        {!result.signatureValid && result.signatureVersion < 2 && <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">This historical record predates the current HMAC signature version. Its ministry status and registry audit trail remain available.</div>}
        {result.detailsAvailable ? <>
          <div className="mt-6 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 print:hidden">{(['overview','transcript','diploma'] as const).map(item=><button key={item} onClick={()=>{setActiveTab(item);setDownloadError('');}} className={`flex-1 whitespace-nowrap rounded-lg px-4 py-2.5 text-sm font-bold capitalize transition ${activeTab===item?'bg-white text-emerald-800 shadow-sm':'text-slate-500 hover:text-slate-800'}`}>{item}</button>)}</div>
          <div id="credential-document" ref={activeDocumentRef} className="print-active-view mt-2">{activeTab==='overview'&&<StudentProfile data={result}/>} {activeTab==='transcript'&&<div className="py-7"><TranscriptTable data={result}/></div>} {activeTab==='diploma'&&<div className="py-7"><OfficialDiploma data={result}/></div>}</div>
        </> : <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
          <h3 className="font-black text-amber-950">Credential details are protected</h3>
          <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-amber-800">Full student identity, transcript, and source documents are displayed only while a credential is verified and its cryptographic signature is valid.</p>
          {result.replacementVerificationCode&&<button type="button" onClick={()=>{navigate(`/verify/${result.replacementVerificationCode}`);void verify(result.replacementVerificationCode!);}} className="mt-4 rounded-xl bg-emerald-800 px-4 py-2.5 text-sm font-bold text-white">Open replacement credential</button>}
        </div>}
        {result.remarks&&<p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900"><strong>Review note:</strong> {result.remarks}</p>}
        {activeAttachment&&<div className="mt-6 text-center print:hidden"><a target="_blank" rel="noreferrer" href={activeAttachment.href} className="inline-flex items-center rounded-lg border border-emerald-800 bg-transparent px-4 py-3 text-sm font-black text-emerald-800 transition hover:bg-emerald-50">{activeAttachment.label}</a></div>}
        <div className="mt-7 flex flex-col justify-between gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center"><div className="flex flex-wrap items-center gap-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-1 font-bold text-emerald-800"><svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3 5 6v5c0 4.8 2.9 8.2 7 10 4.1-1.8 7-5.2 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>Cryptographically Secured</span><span>HMAC-SHA256 signature · {result.securitySignature.slice(0,18)}…</span></div>{result.detailsAvailable&&activeTab!=='overview'&&<div className="sm:text-right"><button type="button" onClick={download} disabled={downloading} className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60 print:hidden">{downloading?'Preparing PDF…':'Download verified PDF'}</button>{downloadError&&<p role="alert" className="mt-2 max-w-sm text-xs font-semibold text-red-600 print:hidden">{downloadError}</p>}</div>}</div>
      </div></article>}
    </section>
  </>;
}
