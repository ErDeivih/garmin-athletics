import type { GymStatsMuscle, LoadPoint, LoadWeek } from '../api/types';
import { formatDate, formatNumber } from '../lib/format';

/*
 * Gráficas del panel Hoy, dibujadas a mano en SVG (sin librería): son dos
 * series pequeñas y así no se mete 100 kB de gráficas en el bundle.
 * Los colores salen de los tokens del sistema; el texto va siempre debajo,
 * para que el dato se pueda leer sin ver el dibujo.
 */

const WIDTH = 600;
const HEIGHT = 180;
const PADDING = 16;

function project(values: number[], min: number, max: number) {
  const span = max - min || 1;
  const step = values.length > 1 ? (WIDTH - PADDING * 2) / (values.length - 1) : 0;
  return values.map((value, index) => ({
    x: PADDING + index * step,
    y: HEIGHT - PADDING - ((value - min) / span) * (HEIGHT - PADDING * 2),
  }));
}

function pathFrom(points: { x: number; y: number }[]): string {
  return points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
}

export function LoadChart({ series }: { series: LoadPoint[] }) {
  if (series.length < 2) {
    return <p className="text-body text-ink-muted">La API no ha devuelto suficiente serie para dibujar la carga.</p>;
  }
  const atl = series.map((point) => point.atl);
  const ctl = series.map((point) => point.ctl);
  const min = Math.min(0, ...atl, ...ctl);
  const max = Math.max(1, ...atl, ...ctl);
  const latest = series[series.length - 1];
  const first = series[0];

  return (
    <figure className="m-0">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-caption">
        <span className="inline-flex items-center gap-1 text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-accent" />
          CTL (forma) {formatNumber(latest?.ctl)}
        </span>
        <span className="inline-flex items-center gap-1 text-ink-muted">
          <span aria-hidden="true" className="size-2 rounded-full bg-warn" />
          ATL (fatiga) {formatNumber(latest?.atl)}
        </span>
        <span className="text-ink-faint">TSB {formatNumber(latest?.tsb)}</span>
      </div>
      <svg
        role="img"
        aria-label="Carga de entrenamiento: ATL y CTL"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-40 w-full"
      >
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          stroke="var(--ga-line)"
          strokeWidth="1"
        />
        <path
          d={pathFrom(project(atl, min, max))}
          fill="none"
          stroke="var(--ga-warn)"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d={pathFrom(project(ctl, min, max))}
          fill="none"
          stroke="var(--ga-accent)"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      <figcaption className="mt-1 flex justify-between text-caption text-ink-faint">
        <span>{formatDate(first?.date)}</span>
        <span>{formatDate(latest?.date)}</span>
      </figcaption>
    </figure>
  );
}

export function BodyBatteryChart({ curve }: { curve: [number, number][] }) {
  const values = curve.map((point) => point[1]);
  if (values.length < 2) {
    return <p className="text-body text-ink-muted">Sin curva de Body Battery para hoy.</p>;
  }
  const points = project(values, 0, 100);
  const line = pathFrom(points);
  const area = `${line} L${points[points.length - 1]?.x.toFixed(1)} ${HEIGHT - PADDING} L${points[0]?.x.toFixed(1)} ${HEIGHT - PADDING} Z`;
  const max = Math.max(...values);
  const min = Math.min(...values);

  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label="Body Battery de hoy: curva de energía"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="h-40 w-full"
      >
        <line
          x1={PADDING}
          y1={HEIGHT - PADDING}
          x2={WIDTH - PADDING}
          y2={HEIGHT - PADDING}
          stroke="var(--ga-line)"
          strokeWidth="1"
        />
        <path d={area} fill="var(--ga-accent-soft)" stroke="none" />
        <path d={line} fill="none" stroke="var(--ga-accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-1 flex flex-wrap justify-between gap-2 text-caption text-ink-faint">
        <span>Mín {formatNumber(min)} / 100</span>
        <span>Máx {formatNumber(max)} / 100</span>
      </figcaption>
    </figure>
  );
}

/** Barras horizontales de volumen por grupo muscular (T-27). */
export function MuscleVolumeChart({ rows }: { rows: GymStatsMuscle[] }) {
  const withVolume = rows.filter((row) => row.tonnage_kg > 0).sort((a, b) => b.tonnage_kg - a.tonnage_kg);
  if (withVolume.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        Sin series de trabajo en el periodo: no hay volumen que repartir por grupo muscular.
      </p>
    );
  }
  const max = Math.max(...withVolume.map((row) => row.tonnage_kg));
  return (
    <div role="img" aria-label="Volumen por grupo muscular en el periodo" className="flex flex-col gap-2">
      {withVolume.map((row) => (
        <div key={row.muscle_group} className="grid grid-cols-[5.5rem_1fr_4.5rem] items-center gap-2">
          <span className="truncate text-caption text-ink-muted">{row.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-raised">
            <span
              className="block h-full rounded-full bg-accent"
              style={{ width: `${Math.max(2, (row.tonnage_kg / max) * 100)}%` }}
            />
          </span>
          <span className="tnum text-right text-caption text-ink">
            {formatNumber(row.tonnage_kg, 'kg')}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barras verticales de TSS por semana (T-27). */
export function WeeklyTssChart({ weeks }: { weeks: LoadWeek[] }) {
  const withTss = weeks.filter((week) => week.tss > 0);
  if (withTss.length === 0) {
    return (
      <p className="text-body text-ink-muted">
        Sin carga semanal en el periodo: las barras aparecerán cuando haya actividades o sesiones.
      </p>
    );
  }
  const max = Math.max(...withTss.map((week) => week.tss));
  return (
    <figure className="m-0">
      <div
        role="img"
        aria-label="TSS por semana en el periodo"
        className="flex h-36 items-end gap-1"
      >
        {withTss.map((week) => (
          <span
            key={week.week_start}
            title={`Semana del ${formatDate(week.week_start)}: ${formatNumber(week.tss)} TSS`}
            className="flex-1 rounded-t-sm bg-accent"
            style={{ height: `${Math.max(3, (week.tss / max) * 100)}%`, opacity: week.complete ? 1 : 0.45 }}
          />
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between text-caption text-ink-faint">
        <span>{formatDate(withTss[0]?.week_start)}</span>
        <span>{formatDate(withTss[withTss.length - 1]?.week_end)}</span>
      </figcaption>
    </figure>
  );
}

/** Línea de monotonía por semana cerrada; los huecos no se rellenan (T-27). */
export function MonotonyChart({ weeks }: { weeks: LoadWeek[] }) {
  const points = weeks
    .map((week, index) => ({ week, index, value: week.monotony }))
    .filter((entry): entry is { week: LoadWeek; index: number; value: number } => entry.value !== null);
  if (points.length < 2) {
    return (
      <p className="text-body text-ink-muted">
        Faltan semanas cerradas para dibujar la monotonía: hacen falta al menos dos.
      </p>
    );
  }
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const width = 560;
  const height = 140;
  const pad = 16;
  const step = (width - pad * 2) / (values.length - 1);
  const path = points
    .map((point, index) => {
      const x = pad + index * step;
      const y = height - pad - ((point.value - min) / span) * (height - pad * 2);
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label="Monotonía semanal del entrenamiento (Foster)"
        viewBox={`0 0 ${width} ${height}`}
        className="h-32 w-full"
      >
        <path d={path} fill="none" stroke="var(--ga-warn)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-caption text-ink-faint">
        <span>{formatDate(points[0]?.week.week_start)}</span>
        <span>{formatDate(points[points.length - 1]?.week.week_start)}</span>
      </figcaption>
    </figure>
  );
}

/** Calendario de calor: un cuadrado por día, intensidad = TSS (T-27). */
export function ActivityHeatmap({ series }: { series: LoadPoint[] }) {
  if (series.length < 7) {
    return <p className="text-body text-ink-muted">Faltan días para dibujar el calendario.</p>;
  }
  const max = Math.max(1, ...series.map((point) => point.tss || 0));
  const first = new Date(`${series[0]?.date ?? ''}T00:00:00`);
  const leading = (first.getDay() + 6) % 7; // lunes = 0
  const cells = [
    ...Array.from({ length: leading }, () => null),
    ...series.map((point) => point),
  ];
  const weeksCount = Math.ceil(cells.length / 7);
  const size = 12;
  const gap = 3;
  const width = weeksCount * (size + gap);
  const height = 7 * (size + gap);
  return (
    <figure className="m-0 overflow-x-auto">
      <svg
        role="img"
        aria-label="Calendario de carga: un cuadro por día, más oscuro con más TSS"
        viewBox={`0 0 ${width} ${height}`}
        className="h-auto w-full min-w-[280px] max-w-[720px]"
      >
        {cells.map((point, index) => {
          if (!point) return null;
          const intensity = (point.tss || 0) / max;
          return (
            <rect
              key={point.date}
              x={(index % weeksCount) * (size + gap)}
              y={Math.floor(index / weeksCount) * (size + gap)}
              width={size}
              height={size}
              rx={2}
              fill="var(--ga-accent)"
              opacity={point.tss ? 0.2 + intensity * 0.8 : 0.08}
            >
              <title>{`${formatDate(point.date)}: ${formatNumber(point.tss)} TSS`}</title>
            </rect>
          );
        })}
      </svg>
    </figure>
  );
}

/** Reparto empuje/tirón del volumen de trabajo (T-26/T-27). */
export function PushPullChart({
  pushPull,
}: {
  pushPull: { push_tonnage_kg: number; pull_tonnage_kg: number; ratio: number | null; note: string };
}) {
  const total = pushPull.push_tonnage_kg + pushPull.pull_tonnage_kg;
  if (total === 0) {
    return (
      <p className="text-body text-ink-muted">
        Sin volumen clasificado de empuje o tirón en el periodo.
      </p>
    );
  }
  const pushPct = Math.round((pushPull.push_tonnage_kg / total) * 100);
  return (
    <figure className="m-0">
      <div role="img" aria-label="Reparto de volumen entre empuje y tirón" className="flex h-8 overflow-hidden rounded-md">
        <span className="bg-accent" style={{ width: `${pushPct}%` }} />
        <span className="bg-warn" style={{ width: `${100 - pushPct}%` }} />
      </div>
      <figcaption className="mt-2 flex flex-wrap justify-between gap-2 text-caption text-ink-muted">
        <span>Empuje {formatNumber(pushPull.push_tonnage_kg, 'kg')} ({pushPct} %)</span>
        <span>Tirón {formatNumber(pushPull.pull_tonnage_kg, 'kg')}</span>
        <span>{pushPull.ratio === null ? 'ratio sin tirón' : `ratio ${formatNumber(pushPull.ratio)}`}</span>
      </figcaption>
      <p className="mt-1 text-caption text-ink-faint">{pushPull.note}</p>
    </figure>
  );
}
