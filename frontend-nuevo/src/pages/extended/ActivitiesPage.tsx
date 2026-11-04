import { useActivities } from '../../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatDate, formatMinutes, formatNumber } from '../../lib/format';

export function ActivitiesPage() {
  const activities = useActivities();

  return (
    <>
      <PageHeader title="Actividades" description="Lo que has hecho, con sus datos reales." />
      {activities.isPending ? (
        <LoadingBlock label="Cargando actividades" />
      ) : activities.isError ? (
        <ErrorState message={activities.error.message} onRetry={() => void activities.refetch()} />
      ) : activities.data.length === 0 ? (
        <EmptyState
          title="Todavía no hay actividades"
          description="Cuando Garmin sincronice o registres una sesión de fuerza, aparecerán aquí con su duración, distancia y TSS. No se inventa ninguna."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {activities.data.map((activity) => (
            <li key={activity.id}>
              <Card as="article" className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-heading text-ink">{activity.name}</h2>
                  <p className="text-caption text-ink-faint">
                    {formatDate(activity.start_time)} · {activity.type} · {formatMinutes(activity.duration_min)}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-caption text-ink-muted">
                  {activity.distance_m ? <span>{formatNumber(activity.distance_m / 1000, 'km')}</span> : null}
                  {activity.avg_hr ? <span>{formatNumber(activity.avg_hr, 'lpm')}</span> : null}
                  {activity.tss !== null ? <span>{formatNumber(activity.tss)} TSS</span> : null}
                  {activity.has_track ? <span>con track</span> : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
