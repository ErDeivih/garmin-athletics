import { Link } from 'react-router-dom';
import { CalendarCheck, Dumbbell, History, ListChecks } from 'lucide-react';
import { useSessions, useTemplates } from '../api/queries';
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { formatDate, formatMinutes, formatNumber, todayWeekday, weekdayName } from '../lib/format';

const startLink =
  'focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-3 text-body font-semibold text-on-accent';
const secondaryLink =
  'focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-raised px-3 text-body font-semibold text-ink';

/** El gimnasio en una pantalla: qué toca, qué plantillas hay y qué has hecho. */
export function GymPage() {
  const templates = useTemplates();
  const sessions = useSessions(5);

  if (templates.isPending || sessions.isPending) {
    return (
      <>
        <PageHeader title="Gimnasio" description="Entrenamiento de fuerza." />
        <LoadingBlock label="Cargando el gimnasio" />
      </>
    );
  }

  if (templates.isError || sessions.isError) {
    const error = templates.error ?? sessions.error;
    return (
      <>
        <PageHeader title="Gimnasio" description="Entrenamiento de fuerza." />
        <ErrorState
          message={error?.message ?? 'No se pudo leer el gimnasio.'}
          onRetry={() => {
            void templates.refetch();
            void sessions.refetch();
          }}
        />
      </>
    );
  }

  const today = todayWeekday();
  const todaysTemplate = templates.data.items.find((template) => template.weekday === today);
  const totalSets = templates.data.items.reduce((sum, template) => sum + template.total_sets, 0);

  return (
    <>
      <PageHeader title="Gimnasio" description="Entrenamiento de fuerza: la sesión de hoy y tu historial." />

      <section aria-label="Hoy toca" className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle hint={weekdayName(today)}>Hoy toca</SectionTitle>
          {todaysTemplate ? (
            <div className="flex flex-col gap-2">
              <span className="font-display text-title uppercase text-ink">{todaysTemplate.name}</span>
              <p className="text-body text-ink-muted">
                {todaysTemplate.exercises.length} ejercicios · {todaysTemplate.total_sets} series ·{' '}
                {formatNumber(todaysTemplate.estimated_tonnage_kg, 'kg')} estimados
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link className={startLink} to={`/gimnasio/entrenar?template=${todaysTemplate.id}`}>
                  Empezar sesión
                </Link>
                <Badge tone="info">Registro con series, descanso y RPE</Badge>
              </div>
            </div>
          ) : (
            <p className="text-body text-ink-muted">
              No hay ninguna plantilla asignada a {weekdayName(today).toLowerCase()}. Puedes elegir otra o crear
              una cuando esté el editor.
            </p>
          )}
        </Card>
        <Card>
          <SectionTitle>Tus números</SectionTitle>
          <dl className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-body text-ink-muted">
                <ListChecks aria-hidden="true" className="size-4" />
                Plantillas
              </dt>
              <dd className="tnum font-display text-title text-ink">{templates.data.total}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-body text-ink-muted">
                <Dumbbell aria-hidden="true" className="size-4" />
                Series planificadas
              </dt>
              <dd className="tnum font-display text-title text-ink">{totalSets}</dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-body text-ink-muted">
                <History aria-hidden="true" className="size-4" />
                Sesiones registradas
              </dt>
              <dd className="tnum font-display text-title text-ink">{sessions.data.total}</dd>
            </div>
          </dl>
        </Card>
      </section>

      <section className="mt-6" aria-label="Plantillas">
        <SectionTitle hint={`${templates.data.total} en total`}>Tus plantillas</SectionTitle>
        {templates.data.items.length === 0 ? (
          <EmptyState
            title="Todavía no hay plantillas"
            description="Una plantilla es la rutina que repites: ejercicios, series, peso y descanso. La API ya las guarda; el editor todavía no está en esta versión."
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {templates.data.items.map((template) => (
              <li key={template.id}>
                <Card as="article" className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-heading text-ink">{template.name}</h3>
                    <p className="text-caption text-ink-faint">
                      {weekdayName(template.weekday)} · {template.exercises.length} ejercicios ·{' '}
                      {template.total_sets} series
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="tnum font-display text-title text-ink">
                      {formatNumber(template.estimated_tonnage_kg, 'kg')}
                    </span>
                    <Link className={secondaryLink} to={`/gimnasio/entrenar?template=${template.id}`}>
                      Empezar
                    </Link>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6" aria-label="Últimas sesiones">
        <SectionTitle hint="5 últimas">Últimas sesiones</SectionTitle>
        {sessions.data.items.length === 0 ? (
          <EmptyState
            title="Todavía no hay sesiones"
            description="Aquí aparecerá cada sesión terminada con su tonelaje, su TSS y su duración real. Los datos de fuerza de Garmin no se importan: se registran aquí."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.data.items.map((session) => (
              <li
                key={session.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-surface px-3 py-2"
              >
                <span className="flex items-center gap-2 text-body text-ink">
                  <CalendarCheck aria-hidden="true" className="size-4 text-ink-faint" />
                  {formatDate(session.date)}
                </span>
                <span className="flex flex-wrap items-center gap-3 text-caption text-ink-muted">
                  <span>{formatNumber(session.total_tonnage_kg, 'kg')}</span>
                  <span>{formatNumber(session.computed_tss)} TSS</span>
                  <span>{session.sets_count} series</span>
                  <span>{formatMinutes(session.duration_min)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
