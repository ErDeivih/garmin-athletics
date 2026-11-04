import { useState } from 'react';
import { useTrends } from '../../api/queries';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';

const METRICS = [
  { value: 'hrv', label: 'HRV' },
  { value: 'sleep_hours', label: 'Sueño (h)' },
  { value: 'sleep_score', label: 'Sueño (score)' },
  { value: 'resting_hr', label: 'FC en reposo' },
  { value: 'body_battery', label: 'Body Battery' },
  { value: 'stress', label: 'Estrés' },
];
// La disposición no está aquí a propósito: si falta biometría, el backend
// rellena sueño/HRV con valores por defecto y la serie parecería real.
// La disposición se lee en Hoy, donde se sabe si hay datos (biometrics_available).

function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 560;
  const height = 120;
  const step = width / (points.length - 1);
  const path = points
    .map((value, index) => `${index === 0 ? 'M' : 'L'} ${index * step} ${height - ((value - min) / range) * (height - 16) - 8}`)
    .join(' ');
  return (
    <svg
      role="img"
      aria-label="Evolución de la métrica seleccionada"
      viewBox={`0 0 ${width} ${height}`}
      className="h-32 w-full"
    >
      <path d={path} fill="none" stroke="var(--ga-accent)" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrendsPage() {
  const [metric, setMetric] = useState('hrv');
  const trends = useTrends(metric, 7);
  const values = trends.data?.series.map((point) => point.value).filter((value): value is number => value !== null) ?? [];

  return (
    <>
      <PageHeader title="Tendencias" description="Cómo evolucionan tus métricas en los últimos 7 días." />
      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Métrica">
        {METRICS.map((option) => (
          <Button
            key={option.value}
            variant={metric === option.value ? 'primary' : 'secondary'}
            aria-pressed={metric === option.value}
            onClick={() => setMetric(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
      {trends.isPending ? (
        <LoadingBlock label="Cargando tendencias" />
      ) : trends.isError ? (
        <ErrorState message={trends.error.message} onRetry={() => void trends.refetch()} />
      ) : values.length === 0 ? (
        <EmptyState
          title="Sin serie para esta métrica"
          description="La API ha respondido, pero no hay valores en la ventana. Suele significar que la sincronización está parada."
        />
      ) : (
        <Card>
          <Sparkline points={values} />
          <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {trends.data.series.map((point) => (
              <li key={point.date} className="rounded-md bg-raised px-3 py-2">
                <span className="block text-caption text-ink-faint">{formatDate(point.date)}</span>
                <span className="tnum font-display text-title text-ink">{formatNumber(point.value)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
