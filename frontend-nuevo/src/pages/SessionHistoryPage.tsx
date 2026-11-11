import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useHistoryExport, useSessions } from '../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../components/ui';
import { buildHistoryCsv, downloadText, nombreExportacion } from '../lib/historial';
import { formatDate, formatMinutes } from '../lib/format';
import { formatWeight, useWeightUnit } from '../lib/units';

/**
 * Historial de sesiones: la lista completa, no solo las cinco últimas del
 * gimnasio. Cada fila lleva fecha, duración, volumen y número de series, y abre
 * el detalle donde se comparan los pesos reales con los planificados.
 * Desde aquí también se exporta todo a CSV o JSON.
 */
export function SessionHistoryPage() {
  const sessions = useSessions(50);
  const unit = useWeightUnit();
  const exportar = useHistoryExport();
  const [errorExportacion, setErrorExportacion] = useState<string | null>(null);

  const descargar = (formato: 'csv' | 'json') => {
    setErrorExportacion(null);
    exportar.mutate({}, {
      onSuccess: (datos) => {
        if (formato === 'csv') {
          downloadText(nombreExportacion('csv'), buildHistoryCsv(datos), 'text/csv;charset=utf-8');
        } else {
          downloadText(nombreExportacion('json'), JSON.stringify(datos, null, 2), 'application/json');
        }
      },
      onError: () => setErrorExportacion('No se pudo exportar el historial.'),
    });
  };

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
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => descargar('csv')}
              disabled={exportar.isPending}
              className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong px-3 text-body font-semibold text-ink disabled:opacity-60"
            >
              {exportar.isPending ? 'Exportando…' : 'Exportar CSV'}
            </button>
            <button
              type="button"
              onClick={() => descargar('json')}
              disabled={exportar.isPending}
              className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong px-3 text-body font-semibold text-ink disabled:opacity-60"
            >
              Exportar JSON
            </button>
            <Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>
          </div>
        }
      />

      {errorExportacion ? (
        <p role="alert" className="mb-2 text-body text-danger">{errorExportacion}</p>
      ) : null}
      <p className="mb-2 text-caption text-ink-faint">
        El CSV lleva una fila por serie con el peso y las reps <strong>previstos frente a los reales</strong>.
      </p>

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
                      <span>{formatWeight(session.total_tonnage_kg, unit)}</span>
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
