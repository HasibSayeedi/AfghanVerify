import { useId, useState } from 'react';
import moheLogo from '../../../assets/mohe-logo.png';
import { resolveUniversityLogoAsset } from '../credentialAssets';

export function MinistryLogo({ className = '' }: { className?: string }) {
  return <img src={moheLogo} alt="Ministry of Higher Education logo" className={`rounded-full bg-transparent object-contain [clip-path:circle(49%_at_50%_50%)] ${className}`}/>;
}

function AcademicShield({ name, className = '' }: { name: string; className?: string }) {
  const gradientId = `shield-${useId().replace(/:/g, '')}`;
  return <svg viewBox="0 0 96 112" role="img" aria-label={`${name} academic shield`} className={className}>
    <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#065f46"/><stop offset="1" stopColor="#0f766e"/></linearGradient></defs>
    <path d="M48 4 88 18v31c0 27-15 47-40 59C23 96 8 76 8 49V18L48 4Z" fill={`url(#${gradientId})`} stroke="#d4af37" strokeWidth="4"/>
    <path d="M25 42 48 30l23 12-23 12-23-12Zm7 11v15c10 7 22 7 32 0V53l-16 8-16-8Z" fill="#fffdf5"/>
    <path d="M28 78h40M34 84h28" stroke="#d4af37" strokeWidth="3" strokeLinecap="round"/>
    <circle cx="48" cy="19" r="3" fill="#d4af37"/>
  </svg>;
}

function ResolvedUniversityImage({ src, name, className }: { src: string; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? <AcademicShield name={name} className={className}/> : <img src={src} alt={`${name} logo`} className={`bg-transparent object-contain ${className}`} onError={()=>setFailed(true)}/>;
}

export function UniversityLogo({ code, name, className = '' }: { code: string; name: string; className?: string }) {
  const source = resolveUniversityLogoAsset(code);
  return source ? <ResolvedUniversityImage key={source} src={source} name={name} className={className}/> : <AcademicShield name={name} className={className}/>;
}
