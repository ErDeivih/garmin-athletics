import { clearToken, readToken } from './token';

/**
 * En desarrollo, `VITE_API_URL` apunta al backend real (por defecto 8000).
 * Nunca se usa una URL relativa sin comprobar: el backend nuevo es el único
 * origen de datos y el Bearer es obligatorio (INVESTIGACION.md §4.1).
 */
export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '');

export class ApiError extends Error {
  readonly status: number;
  readonly detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

async function readDetail(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'detail' in payload) {
      const detail = (payload as { detail: unknown }).detail;
      if (typeof detail === 'string') return detail;
      if (Array.isArray(detail)) {
        return detail
          .map((item) => {
            if (typeof item === 'object' && item !== null && 'msg' in item) return String(item.msg);
            return String(item);
          })
          .join('. ');
      }
    }
  } catch {
    // respuesta sin JSON: se usa el estado HTTP
  }
  return `La API respondió ${response.status}.`;
}

/** Una sola puerta para hablar con la API: Bearer, errores tipados y 401 global. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = readToken();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });

  if (!response.ok) {
    if (response.status === 401 && token) {
      clearToken();
      window.dispatchEvent(new Event('ga:unauthorized'));
    }
    throw new ApiError(response.status, await readDetail(response));
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (text.length === 0) return undefined as T;
  return JSON.parse(text) as T;
}
