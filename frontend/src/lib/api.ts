import axios from 'axios';
import type { AuthSession } from '../types';

const configuredBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
export const apiBaseUrl = configuredBase;
export const hubUrl = `${configuredBase}/notificationHub`;
export const publicVerifyBaseUrl = (import.meta.env.VITE_PUBLIC_VERIFY_BASE_URL as string | undefined)?.replace(/\/$/, '') || window.location.origin;

export const api = axios.create({ baseURL: configuredBase, timeout: 15_000 });

const storageKey = 'afghanverify.session';
export function readSession(): AuthSession | null {
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  try {
    const session = JSON.parse(raw) as AuthSession;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(storageKey);
      return null;
    }
    return session;
  } catch {
    sessionStorage.removeItem(storageKey);
    return null;
  }
}
export const saveSession = (session: AuthSession) => sessionStorage.setItem(storageKey, JSON.stringify(session));
export const clearSession = () => sessionStorage.removeItem(storageKey);

api.interceptors.request.use((config) => {
  const token = readSession()?.token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use((response) => response, (error) => {
  if (error.response?.status === 401) clearSession();
  return Promise.reject(error);
});

export function getApiError(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    const validationErrors = error.response?.data?.errors as Record<string, string[]> | undefined;
    const details = validationErrors ? Object.values(validationErrors).flat().join(' ') : undefined;
    return details || error.response?.data?.message || error.response?.data?.title || fallback;
  }
  return fallback;
}
