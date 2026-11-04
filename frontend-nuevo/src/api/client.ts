import { clearToken, readToken } from './token';

/**
 * Por defecto la API es del mismo origen (`/api/v1`): en desarrollo lo resuelve
 * el proxy de Vite y en producción el reverso que sirva el frontend. `VITE_API_URL`
 * solo se usa cuando la API vive en otro origen (por ejemplo, una prueba local).
 */
const configuredBase = import.meta.env.VITE_API_URL?.trim();
export const API_BASE = (configuredBase ?? '').replace(/\/$/, '');

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
  /**
   * `external`: un 401 lo produce un servicio de terceros (la contraseña de
   * Garmin), no la sesión de la app. No se cierra la sesión ni se borra el
   * token; el error se enseña en el formulario.
   */
  session?: 'app' | 'external';
}

const REQUEST_TIMEOUT_MS = 15_000;

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

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const abortFromCaller = () => controller.abort();
  options.signal?.addEventListener('abort', abortFromCaller, { once: true });

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (options.signal?.aborted) {
      throw new ApiError(0, 'La petición se canceló.');
    }
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw new ApiError(0, 'La API ha tardado demasiado en responder. Comprueba que el backend está encendido.');
    }
    throw new ApiError(0, 'No se pudo conectar con el servidor. Comprueba que la API está encendida.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abortFromCaller);
  }

  if (!response.ok) {
    const isSessionExpiry = response.status === 401 && token !== null && options.session !== 'external';
    if (isSessionExpiry) {
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
