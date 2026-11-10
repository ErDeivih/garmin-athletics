import type { ProgressWeek } from '../api/types';
import { formatDate } from '../lib/format';
import { formatWeight, type WeightUnit } from '../lib/units';

/**
 * Gráfico simple de volumen por semana: barras proporcionales y una lista con
 * el dato exacto de cada semana (incluidas las que quedaron a cero).
 */
export function WeeklyVolumeChart({ weeks, unit }: { weeks: ProgressWeek[]; unit: WeightUnit }) {
  const max = Math.max(1, ...weeks.map((week) => week.tonnage_kg));
  return (
    <div role="img" aria-label="Volumen por semana" className="flex flex-col gap-3">
      <div className="flex h-28 items-end gap-1">
        {weeks.map((week) => (
          <span
            key={week.week_start}
            className="flex h-full flex-1 items-end"
            title={`Semana del ${formatDate(week.week_start)}: ${formatWeight(week.tonnage_kg, unit)}`}
          >
            <span
              className={`block w-full rounded-t ${week.tonnage_kg > 0 ? 'bg-accent' : 'bg-line'}`}
              style={{ height: `${Math.max(2, Math.round((week.tonnage_kg / max) * 100))}%` }}
            />
          </span>
        ))}
      </div>
      <ul className="flex flex-col gap-0.5">
        {[...weeks].reverse().map((week) => (
          <li key={week.week_start} className="flex items-baseline justify-between gap-2 text-caption">
            <span className={week.tonnage_kg > 0 ? 'text-ink' : 'text-ink-muted'}>
              Semana del {formatDate(week.week_start)}
            </span>
            <span className={`tnum ${week.tonnage_kg > 0 ? 'text-ink' : 'text-ink-faint'}`}>
              {formatWeight(week.tonnage_kg, unit)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
