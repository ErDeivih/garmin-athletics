/**
 * Migración de datos locales de la app anterior a Lyfta.
 *
 * Las claves antiguas se conservan solo aquí, para no perder la sesión, el tema,
 * las secciones ampliadas ni los borradores de una sesión abierta. Se mueven a
 * `lyfta.*` sin sobrescribir una clave nueva que ya exista.
 */
const NEW_PREFIX = 'lyfta.';
const LEGACY_PREFIXES = ['carga.', 'pulso.'];

export function migrateLegacyStorage(): void {
  try {
    const storage = window.localStorage;
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key) keys.push(key);
    }
    for (const key of keys) {
      const prefix = LEGACY_PREFIXES.find((candidate) => key.startsWith(candidate));
      if (!prefix) continue;
      const next = `${NEW_PREFIX}${key.slice(prefix.length)}`;
      const value = storage.getItem(key);
      if (value === null) continue;
      if (storage.getItem(next) === null) storage.setItem(next, value);
      storage.removeItem(key);
    }
  } catch {
    // Sin almacenamiento (modo privado) no hay nada que migrar.
  }
}
