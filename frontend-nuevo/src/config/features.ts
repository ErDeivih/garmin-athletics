import { useSyncExternalStore } from 'react';

/**
 * Las secciones ampliadas (Actividades, Calendario, Tendencias, Rendimiento,
 * Rutas, Social) viven detrás de una bandera. La decide el entorno
 * (`VITE_FEATURE_EXTENDED`), pero el atleta puede encenderla desde Ajustes para
 * verlas sin recompilar. Decisión D-08.
 *
 * La verdad está en localStorage (o en el entorno): no se guarda una copia en
 * memoria que pueda quedar desincronizada.
 */
const STORAGE_KEY = 'lyfta.extended';
const STORAGE_KEY_ANTERIOR = 'carga.extended';
const STORAGE_KEY_LEGACY = 'pulso.extended';
const listeners = new Set<() => void>();

function readFlag(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY) ?? window.localStorage.getItem(STORAGE_KEY_ANTERIOR) ?? window.localStorage.getItem(STORAGE_KEY_LEGACY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
    // sin almacenamiento (modo privado): se usa el valor del entorno
  }
  return import.meta.env.VITE_FEATURE_EXTENDED === 'true';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === STORAGE_KEY_ANTERIOR || event.key === STORAGE_KEY_LEGACY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function setExtendedSections(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
    // la preferencia no persiste; el resto de la app sigue funcionando
  }
  listeners.forEach((listener) => listener());
}

export function useExtendedSections(): boolean {
  return useSyncExternalStore(subscribe, readFlag, () => false);
}

export const EXTENDED_SECTIONS_KEY = STORAGE_KEY;
