import { Link } from 'react-router-dom';
import { useCalendar, useWeeklyStats } from '../api/queries';
import { Card, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { formatNumber } from '../lib/format';
import { formatWeight, useWeightUnit } from '../lib/units';

/** Lunes de la semana en curso, en fecha local (no UTC). */
function lunesDeEstaSemana(): Date {
  const hoy = new Date();
  const dia = (hoy.getDay() + 6) % 7; // 0 = lunes
  const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - dia);
  return lunes;
}

function isoLocal(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

/**
 * Resumen de la semana en curso: volumen total, series por grupo muscular y
 * adherencia al plan (sesiones hechas frente a entrenos planificados en el
 * calendario).
 */
export function WeeklySummaryPage() {
  const unit = useWeightUnit();
  const lunes = lunesDeEstaSemana();
  const domingo = new Date(lunes.getFullYear(), lunes.getMonth(), lunes.getDate() + 6);
  const desde = isoLocal(lunes);
  const hasta = isoLocal(domingo);

  const stats = useWeeklyStats(desde, hasta);
  const calendario = useCalendar(desde, hasta);

  if (stats.isPending || calendario.isPending) return <LoadingBlock label="Resumiendo la semana" />;
  if (stats.isError || calendario.isError) {
    return (
      <ErrorState
        message="No se pudo cargar el resumen de la semana."
        onRetry={() => {
          void stats.refetch();
          void calendario.refetch();
        }}
      />
    );
  }

  const totales = stats.data.totals;
  const grupos = [...stats.data.by_muscle].sort((a, b) => b.working_sets - a.working_sets);
  const maxSeries = Math.max(1, ...grupos.map((grupo) => grupo.working_sets));

  const planificadas = calendario.data.days
    .flatMap((dia) => dia.events)
    .filter((evento) => evento.template_id && ['strength', 'planned_workout'].includes(evento.event_type));
  const hechas = totales.sessions;
  const porcentaje = planificadas.length > 0
    ? Math.min(100, Math.round((hechas / planificadas.length) * 100))
    : null;

  return (
    <>
      <PageHeader
        title="Semana"
        description={`Del ${desde} al ${hasta}: volumen, series por grupo y adherencia.`}
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />

      <div className="grid grid-cols-2 gap-2">
        <Card>
          <span className="block text-caption uppercase tracking-wider text-ink-muted">Volumen total</span>
          <span className="tnum font-display text-title text-ink">{formatWeight(totales.tonnage_kg, unit)}</span>
        </Card>
        <Card>
          <span className="block text-caption uppercase tracking-wider text-ink-muted">Sesiones</span>
          <span className="tnum font-display text-title text-ink">{formatNumber(totales.sessions)}</span>
        </Card>
        <Card>
          <span className="block text-caption uppercase tracking-wider text-ink-muted">Series</span>
          <span className="tnum font-display text-title text-ink">{formatNumber(totales.working_sets)}</span>
        </Card>
        <Card>
          <span className="block text-caption uppercase tracking-wider text-ink-muted">Repeticiones</span>
          <span className="tnum font-display text-title text-ink">{formatNumber(totales.reps)}</span>
        </Card>
      </div>

      <Card className="mt-3">
        <SectionTitle hint={`${grupos.length} grupos`}>Adherencia al plan</SectionTitle>
        {planificadas.length === 0 ? (
          <p className="text-body text-ink-muted">
            Esta semana no hay entrenos planificados en el calendario.
          </p>
        ) : (
          <>
            <p className="text-body text-ink">
              {hechas} de {planificadas.length} sesiones planificadas{' '}
              <span className="tnum text-accent">({porcentaje} %)</span>
            </p>
            <span className="mt-2 block h-2 overflow-hidden rounded-full bg-raised">
              <span
                className="block h-full rounded-full bg-accent"
                style={{ width: `${Math.max(2, porcentaje ?? 0)}%` }}
              />
            </span>
          </>
        )}
      </Card>

      <Card className="mt-3">
        <section aria-label="Series por grupo muscular">
          <SectionTitle hint="series de trabajo">Series por grupo muscular</SectionTitle>
          {grupos.length === 0 ? (
            <p className="text-body text-ink-muted">Sin series de trabajo esta semana.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {grupos.map((grupo) => (
                <div key={grupo.muscle_group} className="grid grid-cols-[5.5rem_1fr_6.5rem] items-center gap-2">
                  <span className="truncate text-caption text-ink-muted">{grupo.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-raised">
                    <span
                      className="block h-full rounded-full bg-accent"
                      style={{ width: `${Math.max(2, (grupo.working_sets / maxSeries) * 100)}%` }}
                    />
                  </span>
                  <span className="tnum text-right text-caption text-ink">
                    {grupo.working_sets} series · {formatWeight(grupo.tonnage_kg, unit)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      </Card>
    </>
  );
}
