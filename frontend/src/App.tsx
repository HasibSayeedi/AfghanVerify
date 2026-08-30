import { useState } from 'react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Login from './Login';
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

function Protected({ session, role, children }: { session: AuthSession | null; role: AuthSession['role'] | AuthSession['role'][]; children: React.ReactNode }) {
  const location = useLocation();
  const allowed = session && (Array.isArray(role) ? role.includes(session.role) : session.role === role);
  if (!allowed) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

function Shell() {
  const [session, setSession] = useState<AuthSession | null>(() => readSession());
  const logout = () => { clearSession(); setSession(null); };
  return <div className="flex min-h-screen flex-col bg-slate-100 text-slate-900">
    <header className="sticky top-0 z-40 border-b border-emerald-950/10 bg-white/90 backdrop-blur-xl print:hidden">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3" aria-label="Afghan Verify home">
          <ShieldMark /><div><p className="text-base font-extrabold tracking-tight">Afghan Verify</p><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-emerald-700">National Credential Registry</p></div>
        </Link>
        <nav className="flex items-center gap-2 text-sm font-semibold">
          <Link className="hidden rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 sm:block" to="/">Verify</Link>
          {session?.role === 'University' && <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50" to="/university">Issue record</Link>}
          {session?.role === 'Ministry' && <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50" to="/ministry">Review queue</Link>}
          {(session?.role === 'SUPER_ADMIN' || session?.role === 'UNIVERSITY_ADMIN') && <Link className="rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50" to="/admin/users">User management</Link>}
          {session && <Link className="hidden items-center gap-2 rounded-lg px-3 py-2 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 md:flex" to="/account"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg><span>Profile</span></Link>}
          {session ? <button onClick={logout} className="rounded-xl border border-slate-200 px-3 py-2 hover:border-emerald-300 hover:text-emerald-800">Sign out</button>
            : <Link to="/login" className="rounded-xl bg-emerald-700 px-4 py-2.5 text-white shadow-sm hover:bg-emerald-800">Staff sign in</Link>}
        </nav>
      </div>
    </header>
    <main className="flex-1"><Routes>
      <Route path="/" element={<VerifyDocument />} />
      <Route path="/verify/:token" element={<VerifyDocument />} />
      <Route path="/login" element={session ? <Navigate to={session.role === 'SUPER_ADMIN' || session.role === 'UNIVERSITY_ADMIN' ? '/admin/users' : session.role === 'Ministry' ? '/ministry' : '/university'} replace /> : <Login onLogin={setSession} />} />
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
