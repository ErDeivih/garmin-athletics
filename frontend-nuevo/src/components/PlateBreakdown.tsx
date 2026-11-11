import type { RepartoDiscos } from '../lib/discos';

/**
 * Muestra el reparto de discos de un peso objetivo. Siempre en kg: los discos
 * son físicos aunque la app esté en libras.
 */
export function PlateBreakdown({ reparto, compact = false }: { reparto: RepartoDiscos; compact?: boolean }) {
  return (
    <p className={compact ? 'mt-1 text-caption text-ink-faint' : 'mt-2 text-body text-ink-muted'}>
      <span aria-hidden="true">🏋 </span>
      Discos: <span className="tnum text-ink">{reparto.texto}</span>
      {reparto.restoPorLadoKg > 0 ? (
        <span className="block text-caption text-danger">
          Con los discos disponibles el total sería {reparto.alcanzableKg} kg.
        </span>
      ) : null}
    </p>
  );
}
