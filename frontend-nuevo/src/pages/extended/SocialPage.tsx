import { useLeaderboard } from '../../api/queries';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatNumber } from '../../lib/format';

export function SocialPage() {
  const leaderboard = useLeaderboard();

  return (
    <>
      <PageHeader title="Social" description="Compara tu semana con la de tus amigos." />
      {leaderboard.isPending ? (
        <LoadingBlock label="Cargando la clasificación" />
      ) : leaderboard.isError ? (
        <ErrorState message="No se pudo cargar la clasificación." onRetry={() => void leaderboard.refetch()} />
      ) : leaderboard.data.ranking.length === 0 ? (
        <EmptyState
          title="Aún no hay clasificación"
          description="La clasificación compara la carga semanal: lo que cada uno ha entrenado. Añade amigos y entrena para aparecer."
        />
      ) : (
        <Card>
          <ul className="flex flex-col gap-3">
            {leaderboard.data.ranking.map((entry, index) => (
              <li key={entry.athlete.id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-3">
                  <span className="tnum w-6 font-display text-title text-ink-faint">{index + 1}</span>
                  <span>
                    <span className="block text-body text-ink">
                      {entry.athlete.display_name ?? entry.athlete.username}
                    </span>
                    <span className="block text-caption text-ink-faint">
                      {formatNumber(entry.activity_count)} actividades
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="tnum font-display text-title text-ink">{formatNumber(entry.weekly_tss)}</span>
                  <span className="text-caption text-ink-muted">carga</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
