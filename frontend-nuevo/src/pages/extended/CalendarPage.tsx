import { useState } from 'react';
import {
  useCalendar,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  usePreviewEventWorkout,
  useSendEventWorkout,
  useSyncTodayWorkouts,
  useTemplates,
} from '../../api/queries';
import { Button, Card, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../../components/ui';
import { formatDate, todayWeekday, weekdayName } from '../../lib/format';

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];
const readinessLabel = (status?: string | null) => {
  if (status === 'VERDE') return 'Listo';
  if (status === 'AMARILLO') return 'Cuidado';
  if (status === 'ROJO') return 'Descansa';
  return null;
};

export function CalendarPage() {
  const calendar = useCalendar();
  const templates = useTemplates();
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const preview = usePreviewEventWorkout();
  const sendEvent = useSendEventWorkout();
  const syncToday = useSyncTodayWorkouts();

  const [templateId, setTemplateId] = useState('');
  const [days, setDays] = useState<number[]>([todayWeekday()]);
  const [time, setTime] = useState('18:00');
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (calendar.isPending || templates.isPending) {
    return <LoadingBlock label="Cargando el calendario" />;
  }
  if (calendar.isError || templates.isError) {
    return (
      <ErrorState
        message="No se pudo cargar el calendario."
        onRetry={() => {
          void calendar.refetch();
          void templates.refetch();
        }}
      />
    );
  }

  const weekly = new Map<string, { id: string; title: string; weekday: number; start: string; template_id: string | null }>();
  for (const day of calendar.data.days) {
    for (const event of day.events) {
      if (event.weekday !== null) {
        weekly.set(event.id, {
          id: event.id,
          title: event.title,
          weekday: event.weekday,
          start: event.start,
          template_id: event.template_id,
        });
      }
    }
  }
  const weeklyEvents = [...weekly.values()].sort((a, b) => a.weekday - b.weekday);
  const today = todayWeekday();
  const todayEvents = calendar.data.days.find((day) => day.date === new Date().toISOString().slice(0, 10));
  const selectedTemplate = templates.data.items.find((item) => item.id === templateId);

  const toggleDay = (day: number) => {
    setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  };

  const schedule = async () => {
    if (!selectedTemplate || days.length === 0) return;
    setMessage(null);
    const now = new Date();
    const base = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (const weekday of days) {
      const exists = weeklyEvents.some(
        (event) => event.template_id === selectedTemplate.id && event.weekday === weekday,
      );
      if (exists) continue;
      const offset = (weekday - today + 7) % 7;
      const date = new Date(base);
      date.setDate(base.getDate() + offset);
      const localIso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      try {
        await createEvent.mutateAsync({
          title: selectedTemplate.name,
          event_type: 'strength',
          start_local: `${localIso}T${time}:00`,
          duration_min: 60,
          weekday,
          template_id: selectedTemplate.id,
        });
      } catch {
        setMessage('No se pudo guardar el entrenamiento.');
        return;
      }
    }
    setMessage('Entrenamiento programado. Se cargará en el reloj el día que toque.');
  };

  const previewEvent = weeklyEvents.find((event) => event.id === previewEventId);

  return (
    <>
      <PageHeader title="Calendario" description="Tu semana de entrenamiento." />

      <section aria-label="Programar entrenamiento">
        <Card>
          <SectionTitle hint="Se repite cada semana">Programar entrenamiento</SectionTitle>
          {templates.data.items.length === 0 ? (
            <p className="text-body text-ink-muted">
              Todavía no hay plantillas. Crea una en Gimnasio para programarla.
            </p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Plantilla
                <select
                  value={templateId}
                  onChange={(event) => setTemplateId(event.target.value)}
                  className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
                >
                  <option value="">Elige una plantilla</option>
                  {templates.data.items.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset>
                <legend className="mb-1 text-caption text-ink-muted">Días</legend>
                <div className="flex flex-wrap gap-1.5">
                  {WEEKDAYS.map((day) => (
                    <button
                      key={day}
                      type="button"
                      aria-pressed={days.includes(day)}
                      onClick={() => toggleDay(day)}
                      className={`focus-ring min-h-11 min-w-11 rounded-md border px-2 text-caption font-semibold ${
                        days.includes(day)
                          ? 'border-accent bg-accent-soft text-accent'
                          : 'border-line-strong text-ink-muted'
                      }`}
                    >
                      {weekdayName(day).slice(0, 3)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Hora
                <input
                  type="time"
                  value={time}
                  onChange={(event) => setTime(event.target.value)}
                  className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
                />
              </label>
              <Button variant="primary" onClick={schedule} disabled={!templateId || days.length === 0 || createEvent.isPending}>
                {createEvent.isPending ? 'Guardando…' : 'Programar'}
              </Button>
              {message ? <p role="status" className="text-caption text-success">{message}</p> : null}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-3" aria-label="Entrenamientos semanales">
        <SectionTitle hint={`${weeklyEvents.length} programados`}>Tus entrenamientos semanales</SectionTitle>
        {weeklyEvents.length === 0 ? (
          <p className="text-caption text-ink-faint">Todavía no has programado ninguno.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {weeklyEvents.map((event) => (
              <li key={event.id} className="rounded-md border border-line bg-surface px-3 py-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-body text-ink">
                    {weekdayName(event.weekday)} · {event.title}
                  </span>
                  <span className="text-caption text-ink-faint">{event.start.slice(11, 16)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-2">
                  {event.template_id ? (
                    <>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setPreviewEventId(event.id);
                          preview.mutate(event.id);
                        }}
                      >
                        Previsualizar
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => deleteEvent.mutate(event.id)}
                        disabled={deleteEvent.isPending}
                      >
                        Quitar
                      </Button>
                    </>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
        {previewEventId && previewEvent ? (
          <Card className="mt-2">
            <SectionTitle hint={previewEvent.title}>Enviar al reloj</SectionTitle>
            {preview.isPending ? (
              <p className="text-body text-ink-muted">Preparando…</p>
            ) : preview.isError ? (
              <p role="alert" className="text-body text-danger">No se pudo preparar el envío.</p>
            ) : preview.data ? (
              <div className="flex flex-col gap-2">
                <p className="text-body text-ink">
                  {preview.data.blocks} {preview.data.blocks === 1 ? 'ejercicio' : 'ejercicios'} · ~
                  {Math.round(preview.data.estimated_seconds / 60)} min
                </p>
                {preview.data.unmapped_exercises.length > 0 ? (
                  <p role="alert" className="text-caption text-danger">
                    No se pueden enviar: {preview.data.unmapped_exercises.join(', ')}.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="primary"
                      onClick={() =>
                        sendEvent.mutate(previewEvent.id, {
                          onSuccess: () => setMessage('Enviado al reloj.'),
                          onError: () => setMessage('No se pudo enviar.'),
                        })
                      }
                      disabled={sendEvent.isPending}
                    >
                      {sendEvent.isPending ? 'Enviando…' : 'Enviar al reloj'}
                    </Button>
                    <Button variant="secondary" onClick={() => setPreviewEventId(null)}>
                      Cerrar
                    </Button>
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        ) : null}
      </section>

      {todayEvents?.events.length ? (
        <Card className="mt-3">
          <SectionTitle hint={formatDate(todayEvents.date)}>Hoy</SectionTitle>
          <p className="mb-2 text-body text-ink-muted">Carga el entreno de hoy en el reloj antes de salir.</p>
          <Button
            variant="primary"
            onClick={() =>
              syncToday.mutate(undefined, {
                onSuccess: (result) =>
                  setMessage(
                    result.sent > 0
                      ? 'Entreno de hoy cargado en el reloj.'
                      : result.message ?? 'No hay entrenamientos para hoy.',
                  ),
                onError: () => setMessage('No se pudo cargar en el reloj.'),
              })
            }
            disabled={syncToday.isPending}
          >
            {syncToday.isPending ? 'Cargando…' : 'Cargar el de hoy en el reloj'}
          </Button>
        </Card>
      ) : null}

      <section className="mt-3" aria-label="Semana">
        <SectionTitle hint="14 días">Tu semana</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
          {calendar.data.days.slice(0, 7).map((day) => (
            <Card as="article" key={day.date} className="p-2">
              <div className="mb-1 flex items-center justify-between gap-1">
                <span className="text-caption font-semibold text-ink">{formatDate(day.date)}</span>
                {readinessLabel(day.readiness?.status) ? (
                  <span className="text-caption text-ink-faint">{readinessLabel(day.readiness?.status)}</span>
                ) : null}
              </div>
              {day.events.length === 0 && day.activities.length === 0 ? (
                <p className="text-caption text-ink-faint">Libre</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {day.events.map((event) => (
                    <li key={event.id} className="text-caption text-ink">
                      <span className="mr-1 font-semibold text-accent">Plan</span>
                      {event.title}
                    </li>
                  ))}
                  {day.activities.slice(0, 2).map((activity) => (
                    <li key={activity.id} className="text-caption text-ink-muted">
                      <span className="mr-1 font-semibold text-success">Hecho</span>
                      {activity.name}
                    </li>
                  ))}
                  {day.activities.length > 2 ? (
                    <li className="text-caption text-ink-faint">+{day.activities.length - 2} más</li>
                  ) : null}
                </ul>
              )}
            </Card>
          ))}
        </div>
      </section>
    </>
  );
}
