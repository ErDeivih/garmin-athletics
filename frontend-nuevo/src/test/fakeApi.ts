import { vi } from 'vitest';

export interface FakeRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: unknown;
}

export interface Call extends FakeRequest {
  url: string;
}

export interface FakeResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

type Handler = FakeResponse | ((req: FakeRequest) => FakeResponse | Promise<FakeResponse>);

const normalize = (path: string) => (path.length > 1 ? path.replace(/\/$/, '') : path);

/**
 * Sustituye `fetch` por una tabla de rutas. La clave es `MÉTODO ruta`
 * (`GET /api/v1/auth/me`). Sirve para probar flujos enteros sin el backend.
 */
export function installFakeApi(routes: Record<string, Handler>) {
  const calls: Call[] = [];
  const table = new Map(Object.entries(routes).map(([key, value]) => [key, value]));

  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, 'http://localhost');
    const method = (
      init?.method ?? (typeof input === 'object' && 'method' in input ? String(input.method) : 'GET')
    ).toUpperCase();
    const path = normalize(url.pathname);
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers ?? (typeof input === 'object' && 'headers' in input ? input.headers : undefined);
    if (rawHeaders) {
      if (rawHeaders instanceof Headers) rawHeaders.forEach((value, key) => (headers[key] = value));
      else if (Array.isArray(rawHeaders)) rawHeaders.forEach(([key, value]) => (headers[key] = String(value)));
      else Object.entries(rawHeaders).forEach(([key, value]) => (headers[key] = String(value)));
    }
    let body: unknown;
    if (typeof init?.body === 'string' && init.body.length > 0) {
      try {
        body = JSON.parse(init.body);
      } catch {
        body = init.body;
      }
    }
    const req: FakeRequest = { method, path, query: url.searchParams, headers, body };
    calls.push({ ...req, url: rawUrl });

    const handler = table.get(`${method} ${path}`) ?? table.get(`${method} /`);
    if (!handler) {
      throw new Error(`fake API sin ruta para ${method} ${path}`);
    }
    const result = typeof handler === 'function' ? await handler(req) : handler;
    return new Response(result.body === undefined ? null : JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers: { 'Content-Type': 'application/json', ...(result.headers ?? {}) },
    });
  });

  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const json = (body: unknown, status = 200, headers: Record<string, string> = {}): FakeResponse => ({
  status,
  body,
  headers,
});
