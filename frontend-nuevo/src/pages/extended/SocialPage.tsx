import { useLeaderboard } from '../../api/queries';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatNumber } from '../../lib/format';

export function SocialPage() {
  const leaderboard = useLeaderboard();

  return (
    <>
      <PageHeader title="Social" description="Esfuerzo compartido con tus amigos: solo agregados, nunca datos crudos." />
      {leaderboard.isPending ? (
        <LoadingBlock label="Cargando la clasificación" />
      ) : leaderboard.isError ? (
        <ErrorState message={leaderboard.error.message} onRetry={() => void leaderboard.refetch()} />
      ) : leaderboard.data.ranking.length === 0 ? (
        <EmptyState
          title="Aún no hay clasificación"
          description="La clasificación compara el TSS semanal entre tú y tus amigos. Hace falta añadir amigos y tener actividad en los últimos días."
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
                      {formatNumber(entry.activity_count)} actividades · CTL {formatNumber(entry.ctl)}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  {entry.readiness_status ? (
                    <Badge tone={entry.readiness_status === 'VERDE' ? 'go' : entry.readiness_status === 'ROJO' ? 'stop' : 'warn'}>
                      {entry.readiness_status}
                    </Badge>
                  ) : null}
                  <span className="tnum font-display text-title text-ink">{formatNumber(entry.weekly_tss)}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-caption text-ink-faint">{leaderboard.data.note}</p>
        </Card>
      )}
    </>
  );
}
