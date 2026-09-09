import { Building2, FileClock, ShieldCheck, UsersRound } from 'lucide-react';
import { Link, Navigate } from 'react-router-dom';
import { readSession } from '../../lib/api';

export default function AdminDashboard() {
  const session = readSession();
  if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'UNIVERSITY_ADMIN')) return <Navigate to="/login" replace/>;
  const isSuperAdmin = session.role === 'SUPER_ADMIN';
  const cards = [
    { to: '/admin/users', title: 'User management', description: isSuperAdmin ? 'Manage platform and institutional staff accounts.' : 'Manage staff accounts assigned to your university.', icon: UsersRound },
    ...(isSuperAdmin ? [{ to: '/admin/universities', title: 'Universities', description: 'Register institutions and manage their academic structure.', icon: Building2 }, { to: '/admin/audit-logs', title: 'Audit logs', description: 'Review the immutable trail of sensitive platform activity.', icon: FileClock }] : []),
  ];
  return <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8"><header className="av-card av-card-pad flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-700">Administration workspace</p><h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Dashboard</h1><p className="mt-2 text-sm leading-6 text-slate-500">Choose a secure administration area to continue.</p></div><span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-50 text-[#02382c]"><ShieldCheck className="h-8 w-8"/></span></header><section className={`mt-6 grid gap-5 ${isSuperAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'}`} aria-label="Administration areas">{cards.map(({ to, title, description, icon: Icon }) => <Link key={to} to={to} className="av-card av-card-interactive av-card-pad group min-h-48"><span className="grid h-12 w-12 place-items-center rounded-xl bg-emerald-50 text-[#02382c] transition group-hover:bg-[#02382c] group-hover:text-white"><Icon className="h-6 w-6"/></span><h2 className="av-card-title mt-5 text-lg">{title}</h2><p className="av-card-copy mt-2 text-sm">{description}</p><span className="mt-5 inline-block text-sm font-bold text-emerald-800">Open section →</span></Link>)}</section></div>;
}
