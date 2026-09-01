import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { api, getApiError, hubUrl } from '../../../lib/api';
import type { CertificateData } from '../../../types';

function extractCode(input: string) {
  const trimmed = input.trim().replace(/^#/, '');
  try { const url = new URL(trimmed); return url.pathname.split('/').filter(Boolean).at(-1)?.toUpperCase() ?? ''; }
  catch { return trimmed.toUpperCase(); }
}

export function useVerifyDocument() {
  const [code, setCode] = useState(''); const [result, setResult] = useState<CertificateData | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [showScanner, setShowScanner] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const resultCode = result?.verificationCode;

  const verify = useCallback(async (input: string) => {
    const normalized = extractCode(input);
    if (!/^(?:[A-Z0-9]{2,4}-\d{9}|[A-Z0-9]{2,4}-[A-F0-9]{5}|[A-F0-9]{8})$/.test(normalized)) { setError('Enter the complete university prefix and nine-digit verification code.'); return; }
    setCode(normalized); setLoading(true); setError(''); setResult(null);
    try { const { data } = await api.get<CertificateData>(`/api/verify/${encodeURIComponent(normalized)}`); setResult(data); }
    catch (err) { setError(getApiError(err, 'No valid academic record was found for this code.')); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!resultCode) return;
    const connection = new signalR.HubConnectionBuilder().withUrl(hubUrl).withAutomaticReconnect().build();
    connectionRef.current = connection;
    connection.on('ReceiveStatusUpdate', async (update: { status: string; remarks: string }) => {
      setResult(current => current ? { ...current, ...update } : current);
      try {
        const { data } = await api.get<CertificateData>(`/api/verify/${encodeURIComponent(resultCode)}`);
        setResult(data);
      } catch {
        setResult(current => current ? { ...current, ...update } : current);
      }
    });
    void connection.start().then(() => connection.invoke('SubscribeToCertificate', resultCode)).catch(console.error);
    return () => { connectionRef.current = null; void connection.stop(); };
  }, [resultCode]);

  return { code, setCode, result, error, loading, showScanner, setShowScanner, verify };
}
