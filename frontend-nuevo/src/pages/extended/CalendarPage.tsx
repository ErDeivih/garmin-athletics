import { useCalendar } from '../../api/queries';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { formatDate } from '../../lib/format';

const readinessTone = (status: string | null) => {
  if (status === 'VERDE') return 'go' as const;
  if (status === 'AMARILLO') return 'warn' as const;
  if (status === 'ROJO') return 'stop' as const;
  return 'idle' as const;
};

export function CalendarPage() {
  const calendar = useCalendar();

  const hasAnything = calendar.data?.days.some(
    (day) => day.events.length > 0 || day.activities.length > 0 || day.readiness !== null,
  );

  return (
    <>
      <PageHeader title="Calendario" description="La semana de entrenamiento, con la disposición de cada día." />
      {calendar.isPending ? (
        <LoadingBlock label="Cargando el calendario" />
      ) : calendar.isError ? (
        <ErrorState message={calendar.error.message} onRetry={() => void calendar.refetch()} />
      ) : !hasAnything ? (
        <EmptyState
          title="Semana sin planes"
          description="No hay eventos ni actividades en los últimos días. Los eventos recurrentes y las plantillas por día se podrán crear desde el calendario."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {calendar.data.days.map((day) => (
            <Card as="article" key={day.date}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-heading text-ink">{formatDate(day.date)}</h2>
                {day.readiness?.status ? (
                  <Badge tone={readinessTone(day.readiness.status)}>{day.readiness.status}</Badge>
                ) : (
                  <Badge tone="idle">sin readiness</Badge>
                )}
              </div>
              {day.events.length === 0 && day.activities.length === 0 ? (
                <p className="text-caption text-ink-faint">Sin planes ni actividad.</p>
              ) : (
                <ul className="flex flex-col gap-1 text-body text-ink">
                  {day.events.map((event) => (
                    <li key={event.id} className="flex items-center justify-between gap-2">
                      <span>{event.title}</span>
                      <span className="text-caption text-ink-faint">{event.event_type}</span>
                    </li>
                  ))}
                  {day.activities.map((activity) => (
                    <li key={activity.id} className="flex items-center justify-between gap-2">
                      <span>{activity.name}</span>
                      <span className="text-caption text-ink-faint">{activity.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
