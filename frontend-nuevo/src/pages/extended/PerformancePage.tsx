import { usePerformanceSummary, usePrs, useZones } from '../../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle, StatCard } from '../../components/ui';
import { formatNumber } from '../../lib/format';

export function PerformancePage() {
  const summary = usePerformanceSummary();
  const zones = useZones();
  const prs = usePrs();

  return (
    <>
      <PageHeader title="Rendimiento" description="Tu progreso y tus mejores marcas." />
      {summary.isPending || zones.isPending || prs.isPending ? (
        <LoadingBlock label="Cargando rendimiento" />
      ) : summary.isError || zones.isError || prs.isError ? (
        <ErrorState
          message="No se pudo cargar el rendimiento."
          onRetry={() => {
            void summary.refetch();
            void zones.refetch();
            void prs.refetch();
          }}
        />
      ) : (
        <>
          <section aria-label="Resumen">
            <SectionTitle hint="Últimos 30 días">Resumen</SectionTitle>
            <div className="grid grid-cols-3 gap-2">
              <StatCard label="Sesiones" value={summary.data.current.sessions} foot={`Antes: ${summary.data.previous.sessions}`} />
              <StatCard label="Horas" value={formatNumber(summary.data.current.hours)} unit="h" foot={`Antes: ${formatNumber(summary.data.previous.hours, 'h')}`} />
              <StatCard label="Carga" value={formatNumber(summary.data.current.tss)} hint="Lo entrenado." foot={`Antes: ${formatNumber(summary.data.previous.tss)}`} />
            </div>
          </section>

          <Card className="mt-3">
            <SectionTitle hint="30 días">Zonas de FC</SectionTitle>
            <p className="mb-2 text-caption text-ink-muted">Tiempo en cada zona.</p>
            {zones.data.total_secs === 0 ? (
              <p className="text-body text-ink-muted">Sin tiempo registrado en zonas.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {zones.data.zones.map((zone) => (
                  <li key={zone.zone} className="flex items-center gap-3">
                    <span className="w-16 text-caption text-ink-muted">Z{zone.zone}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
                      <span className="block h-full rounded-full bg-accent" style={{ width: `${zone.pct}%` }} />
                    </span>
                    <span className="tnum w-14 text-right text-caption text-ink">{Math.round(zone.pct)} %</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="mt-3">
            <SectionTitle>Marcas</SectionTitle>
            {prs.data.length === 0 ? (
              <EmptyState
                title="Sin marcas todavía"
                description="Tus mejores marcas aparecerán al sincronizar tus entrenamientos."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {prs.data.map((pr) => (
                  <li key={`${pr.sport ?? 'gym'}-${pr.label}`} className="flex items-center justify-between gap-2">
                    <span className="text-body text-ink">{pr.label}</span>
                    <span className="tnum font-display text-title text-ink">{pr.display}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}
    </>
  );
}
