import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useActivities } from '../../api/queries';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatDate, formatMinutes, formatNumber } from '../../lib/format';

const TYPE_LABEL: Record<string, string> = {
  running: 'Carrera',
  treadmill_running: 'Cinta',
  trail_running: 'Trail',
  cycling: 'Bici',
  mountain_biking: 'BTT',
  e_bike: 'Bici eléctrica',
  indoor_cycling: 'Bici indoor',
  swimming: 'Natación',
  lap_swimming: 'Natación',
  open_water_swimming: 'Aguas abiertas',
  strength: 'Fuerza',
  strength_training: 'Fuerza',
  soccer: 'Fútbol',
  walking: 'Caminar',
  hiking: 'Senderismo',
  rowing: 'Remo',
  yoga: 'Yoga',
  other: 'Otra',
};

const SPORTS = [
  { value: 'all', label: 'Todas' },
  { value: 'running', label: 'Carrera' },
  { value: 'cycling', label: 'Bici' },
  { value: 'strength', label: 'Fuerza' },
  { value: 'soccer', label: 'Fútbol' },
  { value: 'swimming', label: 'Natación' },
];

function typeLabel(type: string): string {
  return TYPE_LABEL[type.toLowerCase()] ?? type;
}

function isoDay(offsetDays = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function ActivitiesPage() {
  const [sport, setSport] = useState('all');
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [limit, setLimit] = useState(20);
  const rangeInvalid = Boolean(fromDate && toDate && fromDate > toDate);
  const filtersActive = sport !== 'all' || search.trim().length > 0 || Boolean(fromDate || toDate);
  const activities = useActivities({
    sport,
    q: search,
    limit,
    from: rangeInvalid ? undefined : fromDate || undefined,
    to: rangeInvalid ? undefined : toDate || undefined,
  });
  const clearFilters = () => {
    setSport('all');
    setSearch('');
    setFromDate('');
    setToDate('');
  };

  return (
    <>
      <PageHeader title="Actividades" description="Tu historial y el detalle de cada salida." />

      <section aria-label="Filtros" className="mb-3 flex flex-col gap-2">
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          Buscar
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre de la actividad"
            className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink placeholder:text-ink-faint"
          />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            Desde
            <input
              type="date"
              value={fromDate}
              max={toDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
              className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            Hasta
            <input
              type="date"
              value={toDate}
              min={fromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
              className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
            />
          </label>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button variant="secondary" onClick={() => { setFromDate(isoDay(-30)); setToDate(''); }}>
            Últimos 30 días
          </Button>
          <Button variant="secondary" onClick={() => { setFromDate(`${isoDay().slice(0, 7)}-01`); setToDate(''); }}>
            Este mes
          </Button>
        </div>
        {rangeInvalid ? (
          <p role="alert" className="text-caption text-danger">La fecha Desde no puede ser posterior a Hasta.</p>
        ) : null}
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Deporte">
          {SPORTS.map((option) => (
            <Button
              key={option.value}
              variant={sport === option.value ? 'primary' : 'secondary'}
              aria-pressed={sport === option.value}
              onClick={() => setSport(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {filtersActive ? (
          <button
            type="button"
            onClick={() => {
              clearFilters();
            }}
            className="focus-ring self-start text-caption font-semibold text-accent underline"
          >
            Quitar filtros
          </button>
        ) : null}
      </section>

      {activities.isPending ? (
        <LoadingBlock label="Cargando actividades" />
      ) : activities.isError ? (
        <ErrorState message="No se pudieron cargar las actividades." onRetry={() => void activities.refetch()} />
      ) : activities.data.length === 0 ? (
        <EmptyState
          title={filtersActive ? 'Sin actividades con esos filtros' : 'Todavía no hay actividades'}
          description={
            filtersActive
              ? 'Prueba otro deporte, cambia las fechas o borra la búsqueda.'
              : 'Cuando sincronices o registres un entrenamiento, aparecerá aquí.'
          }
          action={
            filtersActive ? (
              <Button
                variant="secondary"
                onClick={() => {
                  clearFilters();
                }}
              >
                Quitar filtros
              </Button>
            ) : undefined
          }
        />
      ) : (
        <>
          <p className="mb-2 text-caption text-ink-faint">
            {activities.data.length} {activities.data.length === 1 ? 'actividad' : 'actividades'}
          </p>
          <ul className="flex flex-col gap-2">
            {activities.data.map((activity) => (
              <li key={activity.id}>
                <Link to={`/actividades/${activity.id}`} className="focus-ring block rounded-lg">
                  <Card as="article" className="transition-colors hover:border-accent">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-heading text-ink">{activity.name}</h2>
                      <span className="text-caption text-ink-faint">{formatDate(activity.start_time)}</span>
                    </div>
                    <p className="text-caption text-ink-muted">
                      {typeLabel(activity.type)} · {formatMinutes(activity.duration_min)}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-ink-muted">
                      {activity.distance_m ? <span>{formatNumber(activity.distance_m / 1000, 'km')}</span> : null}
                      {activity.avg_hr ? <span>{formatNumber(activity.avg_hr, 'lpm')} media</span> : null}
                      {activity.gain_m ? <span>{formatNumber(activity.gain_m, 'm')} desnivel</span> : null}
                      {activity.rpe !== null ? <span>esfuerzo {activity.rpe}</span> : null}
                    </div>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
          {activities.data.length === limit && limit < 200 ? (
            <div className="mt-3">
              <Button variant="secondary" onClick={() => setLimit((current) => current + 20)}>
                Ver más actividades
              </Button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
