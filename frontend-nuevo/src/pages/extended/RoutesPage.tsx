import { useRoutes } from '../../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatDate, formatNumber } from '../../lib/format';

const SPORT_LABEL: Record<string, string> = {
  cycling: 'Bici',
  running: 'Carrera',
  hiking: 'Senderismo',
  walking: 'Caminar',
};

export function RoutesPage() {
  const routes = useRoutes();

  return (
    <>
      <PageHeader title="Rutas" description="Tus recorridos guardados." />
      {routes.isPending ? (
        <LoadingBlock label="Cargando rutas" />
      ) : routes.isError ? (
        <ErrorState message="No se pudieron cargar las rutas." onRetry={() => void routes.refetch()} />
      ) : routes.data.length === 0 ? (
        <EmptyState
          title="Todavía no hay rutas"
          description="Cuando guardes un recorrido, aparecerá aquí."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {routes.data.map((route) => (
            <li key={route.id}>
              <Card as="article" className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-heading text-ink">{route.name}</h2>
                  <p className="text-caption text-ink-faint">
                    {SPORT_LABEL[route.sport] ?? route.sport} · {formatDate(route.created_at)}
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
