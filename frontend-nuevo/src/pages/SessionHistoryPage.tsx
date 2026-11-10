import { Link } from 'react-router-dom';
import { useSessions } from '../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../components/ui';
import { formatDate, formatMinutes, formatNumber } from '../lib/format';

/**
 * Historial de sesiones: la lista completa, no solo las cinco últimas del
 * gimnasio. Cada fila lleva fecha, duración, volumen y número de series, y abre
 * el detalle donde se comparan los pesos reales con los planificados.
 */
export function SessionHistoryPage() {
  const sessions = useSessions(50);

  if (sessions.isPending) return <LoadingBlock label="Cargando el historial" />;
  if (sessions.isError) {
    return (
      <ErrorState
        message="No se pudo cargar el historial."
        onRetry={() => void sessions.refetch()}
      />
    );
  }

  const items = sessions.data.items;

  return (
    <>
      <PageHeader
        title="Historial"
        description="Tus sesiones de fuerza: fecha, duración, volumen y series."
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />

      {items.length === 0 ? (
        <EmptyState
          title="Sin sesiones"
          description="Cuando termines una sesión, aparecerá aquí con su volumen y sus series."
        />
      ) : (
        <>
          <p className="mb-2 text-caption text-ink-faint">
            {sessions.data.total} sesiones · mostrando {items.length}
          </p>
          <ul className="flex flex-col gap-2">
            {items.map((session) => (
              <li key={session.id}>
                <Link to={`/gimnasio/sesiones/${session.id}`} className="focus-ring block rounded-lg">
                  <Card as="article">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h2 className="text-heading text-ink">{session.name}</h2>
                      <span className="text-caption text-ink-faint">{formatDate(session.date)}</span>
                    </div>
                    <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-caption text-ink-muted">
                      <span>{session.duration_min != null ? formatMinutes(session.duration_min) : 'Duración sin registrar'}</span>
                      <span>{formatNumber(session.total_tonnage_kg, 'kg')}</span>
                      <span>{session.sets_count} series</span>
                    </p>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
