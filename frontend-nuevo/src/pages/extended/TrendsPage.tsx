import { useState } from 'react';
import { useGymStats, useLoad, useLoadSummary, useSleepPhases, useTrends } from '../../api/queries';
import {
  ActivityHeatmap,
  LoadChart,
  MonotonyChart,
  MuscleVolumeChart,
  PushPullChart,
  SleepPhasesChart,
  WeeklyTssChart,
  WeightRepsScatter,
} from '../../components/charts';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../../components/ui';
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
// rellena sueño/HRV con valores por defecto y la serie parecería real (T-21).

const PERIODS = [
  { days: 7, label: '7 d' },
  { days: 30, label: '30 d' },
  { days: 90, label: '90 d' },
  { days: 365, label: 'Año' },
];

function TrendLine({ series }: { series: { date: string; value: number | null }[] }) {
  const values = series.map((point) => point.value).filter((value): value is number => value !== null);
  if (values.length < 2) {
    return (
      <p className="text-body text-ink-muted">
        Menos de dos puntos en la ventana: no se dibuja una tendencia que no existe.
      </p>
    );
  }
  const width = 600;
  const height = 140;
  const pad = 16;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = (width - pad * 2) / (values.length - 1);
  let index = 0;
  const path = series
    .filter((point) => point.value !== null)
    .map((point) => {
      const x = pad + index * step;
      const y = height - pad - (((point.value as number) - min) / span) * (height - pad * 2);
      index += 1;
      return `${index === 1 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(' ');
  const first = series.find((point) => point.value !== null);
  const last = [...series].reverse().find((point) => point.value !== null);
  return (
    <figure className="m-0">
      <svg
        role="img"
        aria-label="Serie de la métrica seleccionada"
        viewBox={`0 0 ${width} ${height}`}
        className="h-36 w-full"
      >
        <path d={path} fill="none" stroke="var(--ga-accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <figcaption className="mt-1 flex justify-between text-caption text-ink-faint">
        <span>{formatDate(first?.date)}</span>
        <span>{formatDate(last?.date)}</span>
      </figcaption>
    </figure>
  );
}

export function TrendsPage() {
  const [metric, setMetric] = useState('hrv');
  const [period, setPeriod] = useState(30);
  const trends = useTrends(metric, period);
  const load = useLoad(period);
  const summary = useLoadSummary(period);
  const gym = useGymStats(period);
  const sleepPhases = useSleepPhases(period);

  const trendValues = trends.data?.series.filter((point) => point.value !== null) ?? [];
  const completeWeeks = summary.data?.weeks.filter((week) => week.complete) ?? [];
  const lastWeek = [...completeWeeks].reverse().find((week) => week.tss > 0);
  const totals = gym.data?.totals;
  const previousTonnage = gym.data?.previous.tonnage_kg ?? 0;
  const tonnageDelta = totals && previousTonnage > 0
    ? Math.round(((totals.tonnage_kg - previousTonnage) / previousTonnage) * 100)
    : null;

  return (
    <>
      <PageHeader
        title="Tendencias"
        description="Tu evolución, tu carga y tu gimnasio."
        actions={
          <div className="flex flex-wrap gap-2" role="group" aria-label="Periodo">
            {PERIODS.map((option) => (
              <Button
                key={option.days}
                variant={period === option.days ? 'primary' : 'secondary'}
                aria-pressed={period === option.days}
                onClick={() => setPeriod(option.days)}
              >
                {option.label}
              </Button>
            ))}
          </div>
        }
      />

      <Card>
        <SectionTitle hint={trends.data ? `${trends.data.days} días` : undefined}>Métrica</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Métrica">
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
          <LoadingBlock label="Cargando la tendencia" />
        ) : trends.isError ? (
          <ErrorState message="No se pudo cargar la tendencia." onRetry={() => void trends.refetch()} />
        ) : trendValues.length === 0 ? (
          <EmptyState
            title="Sin datos para esta métrica"
            description="No hay valores en este periodo."
          />
        ) : (
          <TrendLine series={trends.data.series} />
        )}
      </Card>

      <section className="mt-3 grid gap-3 lg:grid-cols-2" aria-label="Carga de entrenamiento">
        <Card>
          <SectionTitle hint={`${period} días`}>Carga de entrenamiento</SectionTitle>
          <p className="mb-2 text-caption text-ink-muted">
            Carga aguda: lo entrenado esta semana. Forma: lo acumulado en semanas.
          </p>
          {load.isPending ? (
            <p role="status" className="text-body text-ink-muted">Cargando la carga…</p>
          ) : load.isError ? (
            <p role="alert" className="text-body text-danger">No se pudo cargar la carga.</p>
          ) : (
            <LoadChart series={load.data.series} />
          )}
        </Card>
        <Card>
          <SectionTitle hint="Cada semana">Carga semanal</SectionTitle>
          {summary.isPending ? (
            <p role="status" className="text-body text-ink-muted">Cargando la carga semanal…</p>
          ) : summary.isError ? (
            <p role="alert" className="text-body text-danger">No se pudo cargar la carga semanal.</p>
          ) : (
            <>
              <WeeklyTssChart weeks={summary.data.weeks} />
              <div className="tnum mt-2 grid grid-cols-2 gap-2 text-caption text-ink-muted">
                <span>Carga semanal {formatNumber(lastWeek?.tss)}</span>
                <span>
                  Variación{' '}
                  {lastWeek?.monotony === null || lastWeek?.monotony === undefined
                    ? 'sin dato'
                    : formatNumber(lastWeek.monotony)}
                </span>
              </div>
              <div className="mt-3 border-t border-line pt-2">
                <MonotonyChart weeks={summary.data.weeks} />
              </div>
            </>
          )}
        </Card>
      </section>

      <Card className="mt-3">
        <SectionTitle hint={`${period} días`}>Calendario de actividad</SectionTitle>
        {load.isPending ? (
          <p role="status" className="text-body text-ink-muted">Cargando el calendario…</p>
        ) : load.isError ? (
          <p role="alert" className="text-body text-danger">No se pudo cargar el calendario.</p>
        ) : (
          <ActivityHeatmap series={load.data.series} />
        )}
      </Card>

      <section className="mt-3 grid gap-3 lg:grid-cols-2" aria-label="Sueño y dispersión">
        <Card>
          <SectionTitle hint={`${period} días`}>Fases de sueño</SectionTitle>
          {sleepPhases.isPending ? (
            <p role="status" className="text-body text-ink-muted">Cargando las fases de sueño…</p>
          ) : sleepPhases.isError ? (
            <p role="alert" className="text-body text-danger">No se pudieron cargar las fases de sueño.</p>
          ) : (
            <>
              <SleepPhasesChart series={sleepPhases.data.series} />
              <p className="mt-2 text-caption text-ink-faint">Solo noches con datos.</p>
            </>
          )}
        </Card>
        <Card>
          <SectionTitle hint="Cada punto, una serie">Peso × repeticiones</SectionTitle>
          {gym.isPending ? (
            <p role="status" className="text-body text-ink-muted">Cargando…</p>
          ) : gym.isError ? (
            <p role="alert" className="text-body text-danger">No se pudo cargar la dispersión.</p>
          ) : (
            <WeightRepsScatter sets={gym.data.sets_sample} />
          )}
        </Card>
      </section>

      <section className="mt-3 grid gap-3 lg:grid-cols-2" aria-label="Gimnasio">
        <Card>
          <SectionTitle hint={`${totals?.sessions ?? 0} ${(totals?.sessions ?? 0) === 1 ? 'sesión' : 'sesiones'}`}>
            Volumen por grupo muscular
          </SectionTitle>
          {gym.isPending ? (
            <p role="status" className="text-body text-ink-muted">Cargando el gimnasio…</p>
          ) : gym.isError ? (
            <p role="alert" className="text-body text-danger">No se pudo cargar el gimnasio.</p>
          ) : (
            <>
              <div className="tnum mb-2 grid grid-cols-3 gap-2 text-caption text-ink-muted">
                <span>{formatNumber(totals?.tonnage_kg, 'kg')} totales</span>
                <span>{formatNumber(totals?.working_sets)} series</span>
                <span>{formatNumber(totals?.reps)} repeticiones</span>
              </div>
              <p className="mb-2 text-caption text-ink-faint">
                {tonnageDelta === null
                  ? 'Sin periodo anterior comparable.'
                  : `${tonnageDelta >= 0 ? '+' : ''}${tonnageDelta} % de peso movido que antes.`}
              </p>
              <MuscleVolumeChart rows={gym.data.by_muscle} />
            </>
          )}
        </Card>
        <Card>
          <SectionTitle hint="Por grupo principal">Empuje / tirón</SectionTitle>
          {gym.isPending ? (
            <p role="status" className="text-body text-ink-muted">Cargando el reparto…</p>
          ) : gym.isError ? (
            <p role="alert" className="text-body text-danger">No se pudo cargar el reparto.</p>
          ) : (
            <>
              <PushPullChart pushPull={gym.data.push_pull} />
              <div className="mt-3 border-t border-line pt-2">
                <SectionTitle>Top ejercicios</SectionTitle>
                <ol className="flex flex-col gap-1">
                  {gym.data.by_exercise.slice(0, 5).map((exercise) => (
                    <li key={exercise.exercise_id} className="flex items-center justify-between gap-2 text-body">
                      <span className="truncate text-ink">{exercise.name}</span>
                      <span className="tnum text-caption text-ink-muted">
                        {formatNumber(exercise.tonnage_kg, 'kg')}
                      </span>
                    </li>
                  ))}
                  {gym.data.by_exercise.length === 0 ? (
                    <li className="text-caption text-ink-faint">Sin ejercicios en el periodo.</li>
                  ) : null}
                </ol>
              </div>
            </>
          )}
        </Card>
      </section>
    </>
  );
}
