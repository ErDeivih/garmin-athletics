import { useRoutes } from '../../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';

export function RoutesPage() {
  const routes = useRoutes();

  return (
    <>
      <PageHeader title="Rutas" description="Rutas planificadas y recorridos guardados." />
      {routes.isPending ? (
        <LoadingBlock label="Cargando rutas" />
      ) : routes.isError ? (
        <ErrorState message={routes.error.message} onRetry={() => void routes.refetch()} />
      ) : routes.data.length === 0 ? (
        <EmptyState
          title="Todavía no hay rutas"
          description="Las rutas se crean desde un track o importando un GPX. La pantalla de planificación llega en una tarea posterior; los datos de la API ya están listos."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {routes.data.map((route) => (
            <li key={route.id}>
              <Card as="article" className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-heading text-ink">{route.name}</h2>
                  <p className="text-caption text-ink-faint">
                    {route.sport} · {formatDate(route.created_at)} · {route.points} puntos
                  </p>
                </div>
                <span className="text-caption text-ink-muted">
                  {formatNumber(route.distance_m / 1000, 'km')} · {formatNumber(route.gain_m, 'm')}
                </span>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
