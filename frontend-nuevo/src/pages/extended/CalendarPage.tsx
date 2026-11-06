import { useState } from 'react';
import {
  useCalendar,
  useCreateCalendarEvent,
  useDeleteCalendarEvent,
  usePreviewEventWorkout,
  useSendEventWorkout,
  useSyncUpcomingWorkouts,
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
const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const dayShort = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  const value = new Date(year ?? 2026, (month ?? 1) - 1, day ?? 1);
  return `${day} ${weekdayName((value.getDay() + 6) % 7).slice(0, 1)}`;
};

export function CalendarPage() {
  const calendar = useCalendar();
  const templates = useTemplates();
  const createEvent = useCreateCalendarEvent();
  const deleteEvent = useDeleteCalendarEvent();
  const preview = usePreviewEventWorkout();
  const sendEvent = useSendEventWorkout();
  const syncUpcoming = useSyncUpcomingWorkouts();

  const [templateId, setTemplateId] = useState('');
  const [mode, setMode] = useState<'weekly' | 'once'>('weekly');
  const [days, setDays] = useState<number[]>([todayWeekday()]);
  const [date, setDate] = useState(localIso(new Date()));
  const [time, setTime] = useState('18:00');
  const [until, setUntil] = useState('');
  const [previewEventId, setPreviewEventId] = useState<string | null>(null);
  const [trimDates, setTrimDates] = useState<Record<string, string>>({});
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

  const weekly = new Map<string, { id: string; title: string; weekday: number; start: string; template_id: string | null; recurrence_until?: string | null }>();
  for (const day of calendar.data.days) {
    for (const event of day.events) {
      if (event.weekday !== null) {
        weekly.set(event.id, {
          id: event.id,
          title: event.title,
          weekday: event.weekday,
          start: event.start,
          template_id: event.template_id,
          recurrence_until: event.recurrence_until,
        });
      }
    }
  }
  const weeklyEvents = [...weekly.values()].sort((a, b) => a.weekday - b.weekday);
  const today = todayWeekday();
  const todayEvents = calendar.data.days.find((day) => day.date === localIso(new Date()));
  const selectedTemplate = templates.data.items.find((item) => item.id === templateId);

  const toggleDay = (day: number) => {
    setDays((current) => (current.includes(day) ? current.filter((item) => item !== day) : [...current, day]));
  };

  const schedule = async () => {
    if (!selectedTemplate) return;
    if (mode === 'weekly' && days.length === 0) return;
    setMessage(null);
    const base = new Date();
    const dates: { weekday: number | null; iso: string }[] =
      mode === 'weekly'
        ? days.map((weekday) => {
            const offset = (weekday - today + 7) % 7;
            const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
            return { weekday, iso: localIso(next) };
          })
        : [{ weekday: null, iso: date }];

    for (const item of dates) {
      const exists =
        item.weekday !== null &&
        weeklyEvents.some((event) => event.template_id === selectedTemplate.id && event.weekday === item.weekday);
      if (exists) continue;
      try {
        await createEvent.mutateAsync({
          title: selectedTemplate.name,
          event_type: 'strength',
          start_local: `${item.iso}T${time}:00`,
          duration_min: 60,
          weekday: item.weekday,
          template_id: selectedTemplate.id,
          recurrence_until: mode === 'weekly' && until ? until : null,
        });
      } catch {
        setMessage('No se pudo guardar el entrenamiento.');
        return;
      }
    }
    setMessage(
      mode === 'weekly'
        ? 'Entrenamiento semanal guardado. Se enviará solo al reloj los próximos días.'
        : 'Entrenamiento guardado para ese día.',
    );
  };

  const previewEvent = weeklyEvents.find((event) => event.id === previewEventId);

  return (
    <>
      <PageHeader title="Calendario" description="Tu semana de entrenamiento." />

      <section aria-label="Programar entrenamiento">
        <Card>
          <SectionTitle hint="Semanal o un día concreto">Programar entrenamiento</SectionTitle>
          {templates.data.items.length === 0 ? (
            <p className="text-body text-ink-muted">Todavía no hay plantillas. Crea una en Gimnasio para programarla.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Plantilla
                <select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink">
                  <option value="">Elige una plantilla</option>
                  {templates.data.items.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
              </label>

              <div className="grid grid-cols-2 gap-1 rounded-md border border-line p-1">
                <button type="button" aria-pressed={mode === 'weekly'} onClick={() => setMode('weekly')} className={`focus-ring min-h-10 rounded px-2 text-caption font-semibold ${mode === 'weekly' ? 'bg-accent-soft text-accent' : 'text-ink-muted'}`}>
                  Se repite cada semana
                </button>
                <button type="button" aria-pressed={mode === 'once'} onClick={() => setMode('once')} className={`focus-ring min-h-10 rounded px-2 text-caption font-semibold ${mode === 'once' ? 'bg-accent-soft text-accent' : 'text-ink-muted'}`}>
                  Un día concreto
                </button>
              </div>

              {mode === 'weekly' ? (
                <fieldset>
                  <legend className="mb-1 text-caption text-ink-muted">Días</legend>
                  <div className="grid grid-cols-7 gap-1">
                    {WEEKDAYS.map((day) => (
                      <button key={day} type="button" aria-pressed={days.includes(day)} onClick={() => toggleDay(day)} className={`focus-ring min-h-11 min-w-0 rounded-md border px-1 text-caption font-semibold ${days.includes(day) ? 'border-accent bg-accent-soft text-accent' : 'border-line-strong text-ink-muted'}`}>
                        {weekdayName(day).slice(0, 3)}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <label className="flex flex-col gap-1 text-caption text-ink-muted">
                  Día
                  <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink" />
                </label>
              )}

              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Hora
                <input type="time" value={time} onChange={(event) => setTime(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink" />
              </label>

              {mode === 'weekly' ? (
                <label className="flex flex-col gap-1 text-caption text-ink-muted">
                  Repetir hasta (opcional)
                  <input type="date" value={until} onChange={(event) => setUntil(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink" />
                </label>
              ) : null}

              <Button variant="primary" onClick={schedule} disabled={!templateId || (mode === 'weekly' && days.length === 0) || createEvent.isPending}>
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
                  <span className="text-body text-ink">{weekdayName(event.weekday)} · {event.title}</span>
                  <span className="text-caption text-ink-faint">{event.start.slice(11, 16)}</span>
                </div>
                {event.recurrence_until ? <p className="text-caption text-ink-faint">Hasta {formatDate(event.recurrence_until)}</p> : null}
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  {event.template_id ? (
                    <>
                      <Button variant="secondary" onClick={() => { setPreviewEventId(event.id); preview.mutate(event.id); }}>
                        Previsualizar
                      </Button>
                      <Button variant="ghost" onClick={() => deleteEvent.mutate({ id: event.id })} disabled={deleteEvent.isPending}>
                        Quitar todo
                      </Button>
                      <label className="flex items-center gap-1 text-caption text-ink-muted">
                        Desde
        <input type="date" value={trimDates[event.id] ?? localIso(new Date())} onChange={(inputEvent) => setTrimDates((current) => ({ ...current, [event.id]: inputEvent.target.value }))} className="focus-ring min-h-9 rounded border border-line-strong bg-raised px-1 text-caption text-ink" />
                      </label>
                      <Button variant="ghost" onClick={() => deleteEvent.mutate({ id: event.id, fromDate: trimDates[event.id] ?? localIso(new Date()) })} disabled={deleteEvent.isPending}>
                        Quitar desde aquí
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
                  {preview.data.blocks} {preview.data.blocks === 1 ? 'ejercicio' : 'ejercicios'} · ~{Math.round(preview.data.estimated_seconds / 60)} min
                </p>
                {preview.data.unmapped_exercises.length > 0 ? (
                  <p role="alert" className="text-caption text-danger">No se pueden enviar: {preview.data.unmapped_exercises.join(', ')}.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => sendEvent.mutate(previewEvent.id, { onSuccess: () => setMessage('Enviado al reloj.'), onError: () => setMessage('No se pudo enviar.') })} disabled={sendEvent.isPending}>
                      {sendEvent.isPending ? 'Enviando…' : 'Enviar al reloj'}
                    </Button>
                    <Button variant="secondary" onClick={() => setPreviewEventId(null)}>Cerrar</Button>
                  </div>
                )}
              </div>
            ) : null}
          </Card>
        ) : null}
      </section>

      <Card className="mt-3">
        <SectionTitle hint="Automático">Auto-carga en el reloj</SectionTitle>
        <p className="text-body text-ink-muted">
          Cada mañana se envía solo el entreno de hoy y de los próximos días. Tú solo pulsas empezar en el reloj.
        </p>
        <Button
          className="mt-2"
          variant="secondary"
          onClick={() => syncUpcoming.mutate(undefined, {
            onSuccess: (result) => setMessage(
              result.status === 'not_linked'
                ? 'Vincula tu cuenta para enviar entrenos al reloj.'
                : result.sent > 0
                  ? 'Entrenos de hoy y próximos días enviados.'
                  : result.message ?? 'No hay entrenamientos pendientes.',
            ),
            onError: () => setMessage('No se pudo enviar.'),
          })}
          disabled={syncUpcoming.isPending}
        >
          {syncUpcoming.isPending ? 'Enviando…' : 'Preparar los próximos 7 días'}
        </Button>
      </Card>

      <section className="mt-3" aria-label="Semana">
        <SectionTitle hint="7 días">Tu semana</SectionTitle>
        <div className="grid grid-cols-7 gap-1">
          {calendar.data.days.slice(0, 7).map((day) => (
            <Card as="article" key={day.date} className="min-w-0 p-1.5">
              <div className="mb-1 min-w-0">
                <span className="block truncate text-[10px] font-semibold uppercase text-ink">{dayShort(day.date)}</span>
                {readinessLabel(day.readiness?.status) ? (
                  <span className="block truncate text-[9px] text-ink-faint">{readinessLabel(day.readiness?.status)}</span>
                ) : null}
              </div>
              {day.events.length === 0 && day.activities.length === 0 ? (
                <p className="text-[10px] text-ink-faint">Libre</p>
              ) : (
                <ul className="flex flex-col gap-0.5">
                  {day.events.length > 0 ? (
                    <li className="text-[9px] font-semibold text-accent" title={day.events.map((event) => event.title).join(', ')}>
                      {day.events.length} plan
                    </li>
                  ) : null}
                  {day.activities.length > 0 ? (
                    <li className="text-[9px] text-ink-muted" title={day.activities.map((activity) => activity.name).join(', ')}>
                      {day.activities.length} hecho
                    </li>
                  ) : null}
                </ul>
              )}
            </Card>
          ))}
        </div>
        {todayEvents?.events.length ? <p className="mt-1 text-caption text-ink-faint">Hoy tienes plan: se envía solo al reloj.</p> : null}
      </section>
    </>
  );
}
