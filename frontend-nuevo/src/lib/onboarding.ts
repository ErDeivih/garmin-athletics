/**
 * Primera visita: la app explica qué hace en tres pasos antes de enseñar el
 * panel. Se recuerda en localStorage; Ajustes permite volver a verla.
 */
const STORAGE_KEY = 'lyfta.onboarding';
export const ONBOARDING_KEY = STORAGE_KEY;

export function hasSeenOnboarding(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'visto';
  } catch {
    return true;
  }
}

export function markOnboardingSeen(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, 'visto');
  } catch {
    // sin almacenamiento: se verá en la próxima apertura
  }
}

export function resetOnboarding(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // sin almacenamiento no hay nada que resetear
  }
}
