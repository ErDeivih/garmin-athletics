import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useProgress } from '../api/queries';
import { WeeklyVolumeChart } from '../components/WeeklyVolumeChart';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { formatNumber } from '../lib/format';
import { formatWeight, useWeightUnit } from '../lib/units';

/**
 * Progreso de fuerza: por ejercicio y por semana, volumen de trabajo
 * (peso × reps) y mejor serie. Los datos vienen ya agregados del servidor.
 */
export function ProgressPage() {
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const progreso = useProgress(exerciseId);
  const unit = useWeightUnit();

  if (progreso.isPending) return <LoadingBlock label="Calculando el progreso" />;
  if (progreso.isError) {
    return (
      <ErrorState
        message="No se pudo cargar el progreso."
        onRetry={() => void progreso.refetch()}
      />
    );
  }

  const datos = progreso.data;
  if (datos.exercises.length === 0) {
    return (
      <>
        <PageHeader title="Progreso" description="Volumen y mejor serie por ejercicio y semana." />
        <EmptyState
          title="Sin datos de progreso"
          description="Cuando guardes sesiones con peso, aquí aparecerá el volumen de cada semana."
        />
      </>
    );
  }

  const seleccionado = exerciseId ?? datos.exercise?.id ?? datos.exercises[0]!.id;
  const mejor = datos.totals.best_set;

  return (
    <>
      <PageHeader
        title="Progreso"
        description="Volumen y mejor serie por ejercicio y semana."
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />

      <Card>
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          Ejercicio
          <select
            aria-label="Ejercicio"
            value={seleccionado}
            onChange={(event) => setExerciseId(event.target.value)}
            className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-2 text-body text-ink"
          >
            {datos.exercises.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>{opcion.name}</option>
            ))}
          </select>
        </label>

        <div className="mt-3 grid grid-cols-2 gap-2" aria-label="Resumen del ejercicio">
          <div className="rounded-md border border-line bg-raised px-3 py-2">
            <span className="block text-caption uppercase tracking-wider text-ink-muted">Volumen total</span>
            <span className="tnum font-display text-title text-ink">{formatWeight(datos.totals.tonnage_kg, unit)}</span>
          </div>
          <div className="rounded-md border border-line bg-raised px-3 py-2">
            <span className="block text-caption uppercase tracking-wider text-ink-muted">Series</span>
            <span className="tnum font-display text-title text-ink">{formatNumber(datos.totals.sets)}</span>
          </div>
          <div className="col-span-2 rounded-md border border-line bg-raised px-3 py-2">
            <span className="block text-caption uppercase tracking-wider text-ink-muted">Mejor serie</span>
            <span className="tnum font-display text-title text-ink">
              {mejor ? `${formatWeight(mejor.weight_kg, unit)} × ${mejor.reps}` : 'sin datos'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="mt-3">
        <SectionTitle hint={`${datos.weeks.length} semanas`}>Volumen por semana</SectionTitle>
        <WeeklyVolumeChart weeks={datos.weeks} unit={unit} />
      </Card>
    </>
  );
}
