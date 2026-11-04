import type { LoadPoint } from '../api/types';
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
        aria-label="Carga de entrenamiento de los últimos 30 días: ATL y CTL"
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
