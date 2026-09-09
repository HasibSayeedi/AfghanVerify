import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { Building2, CircleHelp, FileCheck2, FileClock, FilePlus2, Home, Info, LayoutDashboard, LogIn, LogOut, Search, Settings, UsersRound, Workflow, X } from 'lucide-react';
import { clearSession, readSession, sessionClearedEvent } from './lib/api';
import type { AuthSession } from './types';
import { AboutPage, FaqPage, HomePage, HowItWorksPage, PrivacyPolicyPage, TermsOfUsePage } from './features/public/PublicPages';

const Login = lazy(() => import('./Login'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const ResetPassword = lazy(() => import('./ResetPassword'));
const AccountSettings = lazy(() => import('./features/account/AccountSettings'));
const WorkspaceDashboard = lazy(() => import('./features/dashboard/WorkspaceDashboard'));
const AdminDashboard = lazy(() => import('./features/admin/AdminDashboard'));
const SuperAdminUsers = lazy(() => import('./features/admin/SuperAdminUsers'));
const UniversityManagement = lazy(() => import('./features/admin/UniversityManagement'));
const AuditLogs = lazy(() => import('./features/admin/AuditLogs'));
const MinistryPortal = lazy(() => import('./features/ministry-portal/MinistryPortal'));
const IssueCertificate = lazy(() => import('./features/university-portal/IssueCertificate'));
const VerifyDocument = lazy(() => import('./features/verification/VerifyDocument'));

function ShieldMark() {
  return <svg viewBox="0 0 48 48" className="h-11 w-11 shrink-0 drop-shadow-sm" role="img" aria-label="AfghanVerify academic security mark">
    <circle cx="24" cy="24" r="22" fill="#ecfdf5" stroke="#a7f3d0" strokeWidth="1.5"/>
    <path d="M24 7.5 38 13v10.2c0 8.5-5.1 14.8-14 18.1-8.9-3.3-14-9.6-14-18.1V13l14-5.5Z" fill="#02382c"/>
    <path d="M16.5 18.2c2.9-.7 5.4-.2 7.5 1.3 2.1-1.5 4.6-2 7.5-1.3v10.3c-2.8-.6-5.3-.1-7.5 1.4-2.2-1.5-4.7-2-7.5-1.4V18.2Z" fill="none" stroke="#fff" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8"/>
    <path d="M24 19.5v10.4" stroke="#fff" strokeLinecap="round" strokeWidth="1.5"/>
    <path d="m28.2 24.8 2 2 4-4.2" fill="none" stroke="#f59e0b" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5"/>
  </svg>;
}

const roleLabel = (role: AuthSession['role']) => ({ SUPER_ADMIN: 'Super administrator', UNIVERSITY_ADMIN: 'University administrator', Ministry: 'Ministry Reviewer', University: 'University registrar' }[role]);
const userInitials = (displayName: string) => displayName.trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0).toUpperCase()).join('') || 'AV';
const workspaceHome = (session: AuthSession) => session.role === 'SUPER_ADMIN' || session.role === 'UNIVERSITY_ADMIN' ? '/admin' : session.role === 'Ministry' ? '/ministry' : '/university';
const isInternalPath = (path: string) => path === '/account' || path === '/admin' || path.startsWith('/admin/') || path === '/ministry' || path.startsWith('/ministry/') || path === '/university' || path.startsWith('/university/');
const publicNavClass = ({ isActive }: { isActive: boolean }) => `inline-flex min-h-10 items-center gap-1.5 rounded-lg px-3 py-2 transition ${isActive ? 'bg-emerald-50 font-bold text-emerald-900' : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-800'}`;

interface WorkspaceLink { to: string; label: string; icon: React.ReactNode; end?: boolean }

function workspaceLinks(session: AuthSession): WorkspaceLink[] {
  if (session.role === 'SUPER_ADMIN') return [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5"/>, end: true },
    { to: '/admin/users', label: 'User management', icon: <UsersRound className="h-5 w-5"/> },
    { to: '/admin/universities', label: 'Universities', icon: <Building2 className="h-5 w-5"/> },
    { to: '/admin/audit-logs', label: 'Audit logs', icon: <FileClock className="h-5 w-5"/> },
  ];
  if (session.role === 'UNIVERSITY_ADMIN') return [
    { to: '/admin', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5"/>, end: true },
    { to: '/admin/users', label: 'User management', icon: <UsersRound className="h-5 w-5"/> },
  ];
  if (session.role === 'Ministry') return [
    { to: '/ministry', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5"/>, end: true },
    { to: '/ministry/review', label: 'Review queue', icon: <FileCheck2 className="h-5 w-5"/> },
  ];
  return [
    { to: '/university', label: 'Dashboard', icon: <LayoutDashboard className="h-5 w-5"/>, end: true },
    { to: '/university/issue', label: 'Issue credential', icon: <FilePlus2 className="h-5 w-5"/>, end: true },
    { to: '/university/records', label: 'Issued records', icon: <FileCheck2 className="h-5 w-5"/>, end: true },
  ];
}

function Protected({ session, role, children }: { session: AuthSession | null; role: AuthSession['role'] | AuthSession['role'][]; children: React.ReactNode }) {
  const location = useLocation();
  const allowed = session && (Array.isArray(role) ? role.includes(session.role) : session.role === role);
  return allowed ? children : <Navigate to="/login" replace state={{ from: location.pathname }}/>;
}

function LoadingPage() {
  return <div className="grid min-h-[55vh] place-items-center" role="status" aria-live="polite"><span className="h-9 w-9 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-700"/><span className="sr-only">Loading page</span></div>;
}

function AppRoutes({ session, setSession }: { session: AuthSession | null; setSession: (value: AuthSession) => void }) {
  return <Suspense fallback={<LoadingPage/>}><Routes>
    <Route path="/" element={<HomePage/>}/><Route path="/verify" element={<VerifyDocument/>}/><Route path="/verify/:token" element={<VerifyDocument/>}/><Route path="/how-it-works" element={<HowItWorksPage/>}/><Route path="/about" element={<AboutPage/>}/><Route path="/faq" element={<FaqPage/>}/><Route path="/privacy" element={<PrivacyPolicyPage/>}/><Route path="/terms" element={<TermsOfUsePage/>}/>
    <Route path="/login" element={session ? <Navigate to={workspaceHome(session)} replace/> : <Login onLogin={setSession}/>}/><Route path="/forgot-password" element={session ? <Navigate to="/account" replace/> : <ForgotPassword/>}/><Route path="/reset-password" element={session ? <Navigate to="/account" replace/> : <ResetPassword/>}/>
    <Route path="/admin" element={<Protected session={session} role={['SUPER_ADMIN', 'UNIVERSITY_ADMIN']}><AdminDashboard/></Protected>}/><Route path="/admin/users" element={<Protected session={session} role={['SUPER_ADMIN', 'UNIVERSITY_ADMIN']}><SuperAdminUsers/></Protected>}/><Route path="/admin/universities" element={<Protected session={session} role="SUPER_ADMIN"><UniversityManagement/></Protected>}/><Route path="/admin/audit-logs" element={<Protected session={session} role="SUPER_ADMIN"><AuditLogs/></Protected>}/>
    <Route path="/university" element={<Protected session={session} role="University"><WorkspaceDashboard/></Protected>}/><Route path="/university/issue" element={<Protected session={session} role="University"><IssueCertificate/></Protected>}/><Route path="/university/records" element={<Protected session={session} role="University"><IssueCertificate/></Protected>}/><Route path="/ministry" element={<Protected session={session} role="Ministry"><WorkspaceDashboard/></Protected>}/><Route path="/ministry/review" element={<Protected session={session} role="Ministry"><MinistryPortal/></Protected>}/><Route path="/account" element={<Protected session={session} role={['Ministry', 'University', 'SUPER_ADMIN', 'UNIVERSITY_ADMIN']}><AccountSettings session={session!}/></Protected>}/><Route path="*" element={<Navigate to="/" replace/>}/>
  </Routes></Suspense>;
}

function UserSummary({ session, compact = false }: { session: AuthSession; compact?: boolean }) {
  return <Link to="/account" title={`${session.displayName} (${session.username})`} aria-label={`Open profile for ${session.displayName}`} className={`flex min-w-0 items-center gap-3 rounded-xl text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-900 ${compact ? 'px-3 py-2' : 'border border-slate-200 bg-white px-3 py-2.5'}`}><span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#02382c] text-xs font-extrabold text-white">{userInitials(session.displayName)}</span><span className="min-w-0 text-left"><span className="block max-w-56 truncate text-sm font-bold leading-5">{session.displayName}</span><span className="block max-w-56 truncate text-xs font-medium leading-4 text-slate-500">{roleLabel(session.role)}</span>{session.universityName && <span className="block max-w-56 truncate text-[11px] font-bold leading-4 text-emerald-700">{session.universityName}{session.universityCode ? ` (${session.universityCode})` : ''}</span>}</span></Link>;
}

function WorkspaceSidebar({ session, logout }: { session: AuthSession; logout: () => void }) {
  const links = workspaceLinks(session);

  return <aside className="fixed bottom-0 left-0 top-[88px] z-30 hidden w-64 flex-col overflow-hidden border-r border-emerald-950/10 bg-[#02382c] text-white lg:flex print:hidden">
    <div className="shrink-0 border-b border-white/10 px-5 py-5">
      <p className="text-[10px] font-bold uppercase tracking-[.2em] text-emerald-200">Secure workspace</p>
      <p className="mt-1 text-sm font-bold">{roleLabel(session.role)}</p>
    </div>
    <nav className="min-h-0 flex-1 space-y-1 overflow-hidden px-3 py-5" aria-label="Workspace navigation">
      {links.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-white text-[#02382c] shadow-sm' : 'text-emerald-50 hover:bg-white/10 hover:text-white'}`}>{item.icon}<span>{item.label}</span></NavLink>)}
    </nav>
    <div className="shrink-0 space-y-1 border-t border-white/10 bg-[#02382c] p-3">
      <NavLink to="/account" className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-white text-[#02382c]' : 'text-emerald-50 hover:bg-white/10'}`}><Settings className="h-5 w-5"/><span>Personal profile</span></NavLink>
      <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-emerald-50 hover:bg-red-500/15 hover:text-red-100"><LogOut className="h-5 w-5"/><span>Sign out</span></button>
    </div>
  </aside>;
}

function PublicFooter() {
  const linkClass="text-sm font-semibold text-emerald-50/75 transition hover:text-white focus:outline-none focus-visible:rounded focus-visible:ring-2 focus-visible:ring-amber-400";
  return <footer className="border-t border-emerald-900 bg-[#02382c] text-white print:hidden">
    <div className="av-page-container grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]">
      <div className="max-w-md"><Link to="/" className="inline-flex items-center gap-3" aria-label="Afghan Verify home"><ShieldMark/><span className="text-lg font-extrabold tracking-tight">Afghan<span className="text-amber-400">Verify</span></span></Link><p className="mt-4 text-sm leading-6 text-emerald-50/70">Ministry of Higher Education · Secure academic credential infrastructure</p></div>
      <nav aria-label="Footer navigation"><h2 className="text-xs font-black uppercase tracking-[.18em] text-emerald-200">Explore</h2><div className="mt-4 grid gap-3"><Link className={linkClass} to="/verify">Verify</Link><Link className={linkClass} to="/how-it-works">How It Works</Link><Link className={linkClass} to="/about">About</Link><Link className={linkClass} to="/faq">FAQ</Link></div></nav>
      <nav aria-label="Legal navigation"><h2 className="text-xs font-black uppercase tracking-[.18em] text-emerald-200">Legal</h2><div className="mt-4 grid gap-3"><Link className={linkClass} to="/privacy">Privacy Policy</Link><Link className={linkClass} to="/terms">Terms of Use</Link></div></nav>
    </div>
    <div className="border-t border-white/10"><div className="av-page-container flex items-center py-4 text-xs text-emerald-50/60">© 2026 Afghan Verify</div></div>
  </footer>;
}

function Shell() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const internal = Boolean(session && isInternalPath(location.pathname));
  const internalLinks = useMemo(() => session ? workspaceLinks(session) : [], [session]);
  const logout = () => { clearSession(); setSession(null); setMobileMenuOpen(false); };

  useEffect(() => { const clear = () => { setSession(null); setMobileMenuOpen(false); }; window.addEventListener(sessionClearedEvent, clear); return () => window.removeEventListener(sessionClearedEvent, clear); }, []);
  useEffect(() => { if (!session) return; const remaining = new Date(session.expiresAt).getTime() - Date.now(); if (remaining <= 0) { clearSession(); return; } const timeout = window.setTimeout(clearSession, remaining); return () => window.clearTimeout(timeout); }, [session]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden';
    const outside = (event: PointerEvent) => { if (headerRef.current && !headerRef.current.contains(event.target as Node)) setMobileMenuOpen(false); };
    const keyboard = (event: KeyboardEvent | Event) => { if ((event instanceof KeyboardEvent && event.key === 'Escape') || (event.type === 'resize' && window.innerWidth >= 1024)) setMobileMenuOpen(false); };
    document.addEventListener('pointerdown', outside); window.addEventListener('keydown', keyboard as EventListener); window.addEventListener('resize', keyboard);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', keyboard as EventListener); window.removeEventListener('resize', keyboard); };
  }, [mobileMenuOpen]);

  const mobileLinkClass = ({ isActive }: { isActive: boolean }) => `relative flex min-h-12 items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${isActive ? 'bg-emerald-50 text-[#02382c]' : 'text-slate-600 hover:bg-slate-50 hover:text-[#02382c]'}`;
  return <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
    <header ref={headerRef} className="sticky top-0 z-40 shrink-0 border-b border-emerald-950/10 bg-white/95 shadow-[0_1px_0_rgba(15,23,42,0.03)] backdrop-blur-xl print:hidden"><div className="av-page-container flex min-h-[88px] items-center justify-between py-3"><Link to={internal && session ? workspaceHome(session) : '/'} className="flex min-w-0 max-w-[calc(100%-3.25rem)] items-center gap-3" aria-label={internal ? 'Workspace dashboard' : 'Afghan Verify home'}><ShieldMark/><div className="min-w-0"><p className="text-base font-extrabold tracking-tight text-slate-900">Afghan<span className="text-emerald-700">Verify</span></p><p className="truncate text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-700">{internal ? 'Administration workspace' : 'National Credential Registry'}</p></div></Link>
      {!internal && <nav className="hidden items-center gap-1 text-sm font-semibold lg:flex" aria-label="Public navigation"><NavLink className={publicNavClass} to="/" end>Home</NavLink><NavLink className={publicNavClass} to="/verify"><Search className="h-4 w-4"/>Verify</NavLink><NavLink className={publicNavClass} to="/how-it-works">How it works</NavLink><NavLink className={publicNavClass} to="/about">About</NavLink><NavLink className={publicNavClass} to="/faq">FAQ</NavLink>{session ? <Link to={workspaceHome(session)} className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#02382c] px-4 py-2 text-white hover:bg-emerald-900"><LayoutDashboard className="h-4 w-4"/>Open workspace</Link> : <Link to="/login" className="ml-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#02382c] px-4 py-2 text-white hover:bg-emerald-900"><LogIn className="h-4 w-4"/>Staff sign in</Link>}</nav>}
      {internal && session && <div className="hidden lg:block"><UserSummary session={session} compact/></div>}<button type="button" onClick={() => setMobileMenuOpen(open => !open)} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} className="ml-3 grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 lg:hidden">{mobileMenuOpen ? <X className="h-6 w-6"/> : <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16"/></svg>}</button></div>
      {mobileMenuOpen && <nav id="mobile-navigation" onClick={() => setMobileMenuOpen(false)} aria-label={internal ? 'Workspace navigation' : 'Public navigation'} className="animate-dropdown absolute left-0 right-0 top-full max-h-[calc(100dvh-5.5rem)] overflow-y-auto overscroll-contain border-t border-slate-200 bg-white shadow-xl lg:hidden sm:left-auto sm:right-6 sm:top-[calc(100%+0.5rem)] sm:w-[min(24rem,calc(100vw-3rem))] sm:rounded-2xl sm:border">{internal && session && <div className="border-b border-slate-100 p-3"><UserSummary session={session} compact/></div>}<div className="grid gap-1 p-3">{internal && session ? <>{internalLinks.map(item => <NavLink key={item.to} to={item.to} end={item.end} className={mobileLinkClass}>{item.icon}<span>{item.label}</span></NavLink>)}<NavLink to="/account" className={mobileLinkClass}><Settings className="h-5 w-5"/><span>Personal profile</span></NavLink></> : <><NavLink to="/" end className={mobileLinkClass}><Home className="h-5 w-5"/><span>Home</span></NavLink><NavLink to="/verify" className={mobileLinkClass}><Search className="h-5 w-5"/><span>Verify credential</span></NavLink><NavLink to="/how-it-works" className={mobileLinkClass}><Workflow className="h-5 w-5"/><span>How it works</span></NavLink><NavLink to="/about" className={mobileLinkClass}><Info className="h-5 w-5"/><span>About</span></NavLink><NavLink to="/faq" className={mobileLinkClass}><CircleHelp className="h-5 w-5"/><span>FAQ</span></NavLink></>}</div><div className="border-t border-slate-100 p-3">{session ? internal ? <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-semibold text-slate-600 hover:bg-red-50 hover:text-red-700"><LogOut className="h-5 w-5"/><span>Sign out</span></button> : <Link to={workspaceHome(session)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#02382c] px-4 py-3 text-sm font-bold text-white"><LayoutDashboard className="h-5 w-5"/>Open workspace</Link> : <Link to="/login" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#02382c] px-4 py-3 text-sm font-bold text-white"><LogIn className="h-5 w-5"/>Staff sign in</Link>}</div></nav>}
    </header>
    {internal && session ? <div className="flex-1"><WorkspaceSidebar session={session} logout={logout}/><main className="min-w-0 overflow-x-clip lg:pl-64 print:pl-0"><AppRoutes session={session} setSession={setSession}/></main></div> : <main className="flex-1"><AppRoutes session={session} setSession={setSession}/></main>}
    {!internal && <PublicFooter/>}
  </div>;
}

export default function App() { return <BrowserRouter><Shell/></BrowserRouter>; }
