import { Scanner } from '@yudiel/react-qr-scanner';

export default function QrScanner({ onScanSuccess }: { onScanSuccess: (text: string) => void }) {
  return <div className="overflow-hidden rounded-2xl bg-slate-950 p-3 shadow-2xl">
    <div className="relative aspect-square overflow-hidden rounded-xl">
      <Scanner constraints={{ facingMode: 'environment' }} onScan={(codes) => {
        const value = codes[0]?.rawValue; if (value) onScanSuccess(value);
      }} onError={(error) => console.error('QR scanner error', error)}
      styles={{ container: { width: '100%', height: '100%' }, video: { width: '100%', height: '100%', objectFit: 'cover' } }}
      components={{ finder: false }} />
      <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-emerald-400 shadow-[0_0_0_999px_rgba(2,6,23,.45)]"><span className="absolute left-3 right-3 top-1/2 h-px animate-scan bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" /></div>
    </div>
    <p className="px-4 py-3 text-center text-xs font-medium text-slate-300">Position the official QR code inside the frame</p>
  </div>;
}
