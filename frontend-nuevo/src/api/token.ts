const TOKEN_KEY = 'lyfta.token';
const LEGACY_TOKEN_KEYS = ['carga.token', 'pulso.token'];

/** El token es opaco y caduca a los 30 días; no hay refresh (INVESTIGACION.md §4.4). */
export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY)
      ?? LEGACY_TOKEN_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean)
      ?? null;
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  for (const key of LEGACY_TOKEN_KEYS) window.localStorage.removeItem(key);
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
