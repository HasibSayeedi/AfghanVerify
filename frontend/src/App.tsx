import { useEffect, useRef, useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Login from './Login';
import ForgotPassword from './ForgotPassword';
import ResetPassword from './ResetPassword';
import AccountSettings from './features/account/AccountSettings';
import SuperAdminUsers from './features/admin/SuperAdminUsers';
import MinistryPortal from './features/ministry-portal/MinistryPortal';
import IssueCertificate from './features/university-portal/IssueCertificate';
import VerifyDocument from './features/verification/VerifyDocument';
import { clearSession, readSession } from './lib/api';
import type { AuthSession } from './types';

function ShieldMark() {
  return <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-700 text-white shadow-lg shadow-emerald-900/20">
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>
  </div>;
}

const roleLabel = (role: AuthSession['role']) => ({
  SUPER_ADMIN: 'Super administrator',
  UNIVERSITY_ADMIN: 'University administrator',
  Ministry: 'Ministry reviewer',
  University: 'University registrar',
}[role]);

const userInitials = (displayName: string) => displayName
  .trim()
  .split(/\s+/)
  .slice(0, 2)
  .map(part => part.charAt(0).toUpperCase())
  .join('') || 'AV';

type MobileMenuIconName = 'verify' | 'issue' | 'review' | 'users';

function MobileMenuIcon({ name }: { name: MobileMenuIconName }) {
  return <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'verify' && <><path d="M12 3 5 6v5c0 4.7 2.8 8.2 7 10 4.2-1.8 7-5.3 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></>}
    {name === 'issue' && <><path d="M6 3h9l3 3v15H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/></>}
    {name === 'review' && <><path d="M9 5H6a2 2 0 0 0-2 2v12h16V7a2 2 0 0 0-2-2h-3"/><path d="M9 3h6v4H9zM8 12h8M8 16h5"/></>}
    {name === 'users' && <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>}
  </svg>;
}

function Protected({ session, role, children }: { session: AuthSession | null; role: AuthSession['role'] | AuthSession['role'][]; children: React.ReactNode }) {
  const location = useLocation();
  const allowed = session && (Array.isArray(role) ? role.includes(session.role) : session.role === role);
  if (!allowed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function Shell() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const location = useLocation();
  const logout = () => { clearSession(); setSession(null); setMobileMenuOpen(false); };
  const closeMobileMenu = () => setMobileMenuOpen(false);
  const isMobileNavActive = (path: string) => path === '/'
    ? location.pathname === '/' || location.pathname.startsWith('/verify/')
    : location.pathname.startsWith(path);
  const mobileNavClass = (path: string) => {
    const active = isMobileNavActive(path);
    return `relative flex min-h-12 items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors duration-200 ${active
      ? 'bg-emerald-50 font-bold text-[#02382c]'
      : 'font-semibold text-slate-600 hover:bg-slate-50 hover:text-[#02382c]'}`;
  };

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(event.target as Node)) closeMobileMenu();
    };
    const closeOnEscapeOrResize = (event: KeyboardEvent | Event) => {
      if ((event instanceof KeyboardEvent && event.key === 'Escape') || (event.type === 'resize' && window.innerWidth >= 1024)) closeMobileMenu();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    window.addEventListener('keydown', closeOnEscapeOrResize as EventListener);
    window.addEventListener('resize', closeOnEscapeOrResize);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      window.removeEventListener('keydown', closeOnEscapeOrResize as EventListener);
      window.removeEventListener('resize', closeOnEscapeOrResize);
    };
  }, [mobileMenuOpen]);

  return <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
    <header ref={headerRef} className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/90 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex min-w-0 max-w-[calc(100%-3.25rem)] items-center gap-3" aria-label="Afghan Verify home">
          <ShieldMark /><div className="min-w-0"><p className="text-base font-extrabold tracking-tight">Afghan Verify</p><p className="truncate text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-700">National Credential Registry</p></div>
        </Link>
        <nav className="hidden items-center gap-2 text-sm font-semibold lg:flex">
          <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800" to="/">Verify</Link>
          {session?.role === 'University' && <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50" to="/university">Issue record</Link>}
          {session?.role === 'Ministry' && <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50" to="/ministry">Review queue</Link>}
          {(session?.role === 'SUPER_ADMIN' || session?.role === 'UNIVERSITY_ADMIN') && <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50" to="/admin/users">User management</Link>}
          {session && <Link title={`${session.displayName} (${session.username})`} aria-label={`Open profile for ${session.displayName}`} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-900" to="/account">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#02382c] text-[11px] font-extrabold text-white">{userInitials(session.displayName)}</span>
            <span className="min-w-0 text-left"><span className="block max-w-36 truncate text-xs font-bold leading-4">{session.displayName}</span><span className="block max-w-36 truncate text-[10px] font-medium leading-4 text-slate-500">{roleLabel(session.role)}</span></span>
          </Link>}
          {session ? <button onClick={logout} className="rounded-xl border border-slate-200 px-3 py-2 hover:border-emerald-300 hover:text-emerald-800">Sign out</button>
            : <Link to="/login" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-white shadow-sm hover:bg-emerald-800">Staff sign in</Link>}
        </nav>
        <button type="button" onClick={() => setMobileMenuOpen(open => !open)} aria-expanded={mobileMenuOpen} aria-controls="mobile-navigation" aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'} className="ml-3 grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800 lg:hidden">
          <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">{mobileMenuOpen ? <path d="m6 6 12 12M18 6 6 18"/> : <path d="M4 7h16M4 12h16M4 17h16"/>}</svg>
        </button>
      </div>
      {mobileMenuOpen && <nav id="mobile-navigation" aria-label="Mobile navigation" className="animate-dropdown absolute left-0 right-0 top-full max-h-[calc(100vh-5rem)] overflow-y-auto border-t border-slate-200 bg-white shadow-xl lg:hidden sm:left-auto sm:right-6 sm:top-[calc(100%+0.5rem)] sm:w-[min(24rem,calc(100vw-3rem))] sm:rounded-2xl sm:border sm:border-slate-200">
        {session && <Link onClick={closeMobileMenu} to="/account" className="flex min-w-0 items-center gap-3 border-b border-slate-100 px-5 py-4 text-slate-800 transition hover:bg-slate-50">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#02382c] text-[10px] font-extrabold text-white">{userInitials(session.displayName)}</span>
          <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold leading-5">{session.displayName}</span><span className="block truncate text-[11px] leading-4 text-slate-500">{session.username}</span><span className="block truncate text-[10px] font-semibold leading-4 text-emerald-700">{roleLabel(session.role)}</span></span>
          <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </Link>}

        <div className="px-3 py-3">
          <div className="grid gap-0.5">
            <Link onClick={closeMobileMenu} aria-current={isMobileNavActive('/') ? 'page' : undefined} className={mobileNavClass('/')} to="/">{isMobileNavActive('/') && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#02382c]"/>}<MobileMenuIcon name="verify"/><span>Verify credential</span></Link>
            {session?.role === 'University' && <Link onClick={closeMobileMenu} aria-current={isMobileNavActive('/university') ? 'page' : undefined} className={mobileNavClass('/university')} to="/university">{isMobileNavActive('/university') && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#02382c]"/>}<MobileMenuIcon name="issue"/><span>Issue record</span></Link>}
            {session?.role === 'Ministry' && <Link onClick={closeMobileMenu} aria-current={isMobileNavActive('/ministry') ? 'page' : undefined} className={mobileNavClass('/ministry')} to="/ministry">{isMobileNavActive('/ministry') && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#02382c]"/>}<MobileMenuIcon name="review"/><span>Review queue</span></Link>}
            {(session?.role === 'SUPER_ADMIN' || session?.role === 'UNIVERSITY_ADMIN') && <Link onClick={closeMobileMenu} aria-current={isMobileNavActive('/admin/users') ? 'page' : undefined} className={mobileNavClass('/admin/users')} to="/admin/users">{isMobileNavActive('/admin/users') && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[#02382c]"/>}<MobileMenuIcon name="users"/><span>User management</span></Link>}
          </div>
        </div>

        <div className="border-t border-slate-100 p-3">
          {session ? <button type="button" onClick={logout} className="flex min-h-12 w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm font-semibold text-slate-600 transition hover:bg-red-50 hover:text-red-700">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 17l5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/></svg><span>Sign out</span>
          </button> : <Link onClick={closeMobileMenu} to="/login" className="flex min-h-12 w-full items-center justify-center rounded-lg bg-[#02382c] px-4 py-3 text-sm font-bold text-white hover:bg-emerald-900">Staff sign in</Link>}
        </div>
      </nav>}
    </header>
    <main className="flex-1"><Routes>
      <Route path="/" element={<VerifyDocument />} />
      <Route path="/verify/:token" element={<VerifyDocument />} />
      <Route path="/login" element={session ? <Navigate to={session.role === 'SUPER_ADMIN' || session.role === 'UNIVERSITY_ADMIN' ? '/admin/users' : session.role === 'Ministry' ? '/ministry' : '/university'} replace /> : <Login onLogin={setSession} />} />
      <Route path="/forgot-password" element={session ? <Navigate to="/account" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={session ? <Navigate to="/account" replace /> : <ResetPassword />} />
      <Route path="/university" element={<Protected session={session} role="University"><IssueCertificate /></Protected>} />
      <Route path="/ministry" element={<Protected session={session} role="Ministry"><MinistryPortal /></Protected>} />
      <Route path="/admin/users" element={<Protected session={session} role={['SUPER_ADMIN', 'UNIVERSITY_ADMIN']}><SuperAdminUsers /></Protected>} />
      <Route path="/account" element={<Protected session={session} role={['Ministry', 'University', 'SUPER_ADMIN', 'UNIVERSITY_ADMIN']}><AccountSettings session={session!} /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes></main>
    <footer className="border-t border-slate-200 bg-white py-8 text-center text-xs text-slate-500 print:hidden">Ministry of Higher Education · Secure academic credential infrastructure</footer>
  </div>;
}

export default function App() { return <BrowserRouter><Shell /></BrowserRouter>; }
