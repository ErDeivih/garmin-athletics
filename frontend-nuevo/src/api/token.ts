const TOKEN_KEY = 'carga.token';
const TOKEN_KEY_ANTERIOR = 'pulso.token';

/** El token es opaco y caduca a los 30 días; no hay refresh (INVESTIGACION.md §4.4). */
export function readToken(): string | null {
  try {
    return window.localStorage.getItem(TOKEN_KEY) ?? window.localStorage.getItem(TOKEN_KEY_ANTERIOR);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(TOKEN_KEY_ANTERIOR);
}

export const TOKEN_STORAGE_KEY = TOKEN_KEY;
