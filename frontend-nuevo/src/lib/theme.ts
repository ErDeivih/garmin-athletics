/** El tema elegido sobrevive a recargar: se lee y se aplica antes de pintar la app. */
export type Theme = 'dark' | 'light';

export const THEME_KEY = 'carga.theme';

export function readTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  try {
    window.localStorage.setItem(THEME_KEY, theme);
  } catch {
    // sin persistencia (modo privado): el tema dura lo que la pestaña
  }
}

export function initTheme(): Theme {
  const theme = readTheme();
  document.documentElement.dataset.theme = theme;
  return theme;
}
