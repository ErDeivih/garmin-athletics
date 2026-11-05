import { Link } from 'react-router-dom';
import { useActivities } from '../../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
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

function typeLabel(type: string): string {
  return TYPE_LABEL[type.toLowerCase()] ?? type;
}

export function ActivitiesPage() {
  const activities = useActivities();

  return (
    <>
      <PageHeader title="Actividades" description="Tu historial y el detalle de cada salida." />
      {activities.isPending ? (
        <LoadingBlock label="Cargando actividades" />
      ) : activities.isError ? (
        <ErrorState message="No se pudieron cargar las actividades." onRetry={() => void activities.refetch()} />
      ) : activities.data.length === 0 ? (
        <EmptyState
          title="Todavía no hay actividades"
          description="Cuando sincronices o registres un entrenamiento, aparecerá aquí."
        />
      ) : (
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
      )}
    </>
  );
}
