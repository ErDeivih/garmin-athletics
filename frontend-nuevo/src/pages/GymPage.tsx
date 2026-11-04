import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarCheck, Dumbbell, History, ListChecks } from 'lucide-react';
import { usePushWorkout, useSessions, useTemplate, useTemplates } from '../api/queries';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { formatDate, formatMinutes, formatNumber, todayWeekday, weekdayName } from '../lib/format';

const startLink =
  'focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-3 text-body font-semibold text-on-accent';
const secondaryLink =
  'focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-raised px-3 text-body font-semibold text-ink';

/** El gimnasio en una pantalla: qué toca, qué plantillas hay y qué has hecho. */
export function GymPage() {
  const templates = useTemplates();
  const sessions = useSessions(5);
  const today = todayWeekday();
  const todaysTemplate = templates.data?.items.find((template) => template.weekday === today) ?? null;
  const template = useTemplate(todaysTemplate?.id ?? null);
  const push = usePushWorkout();
  const [sendOpen, setSendOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const startPreview = () => {
    if (!template.data) return;
    setSendOpen(true);
    setConfirmed(false);
    push.mutate({
      routineName: template.data.name,
      exercises: template.data.exercises.flatMap((item) =>
        item.exercise
          ? [{
              name: item.exercise.name,
              sets: item.sets,
              reps: item.reps,
              weight_kg: item.weight_kg,
              rest_seconds: item.rest_seconds,
            }]
          : [],
      ),
      dryRun: true,
    });
  };

  const sendForReal = () => {
    if (!template.data) return;
    push.mutate({
      routineName: template.data.name,
      exercises: template.data.exercises.flatMap((item) =>
        item.exercise
          ? [{
              name: item.exercise.name,
              sets: item.sets,
              reps: item.reps,
              weight_kg: item.weight_kg,
              rest_seconds: item.rest_seconds,
            }]
          : [],
      ),
      dryRun: false,
    });
  };

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

  const totalSets = templates.data.items.reduce((sum, item) => sum + item.total_sets, 0);

  return (
    <>
      <PageHeader
        title="Gimnasio"
        description="Entrenamiento de fuerza: la sesión de hoy y tu historial."
        actions={
          <Link className={secondaryLink} to="/gimnasio/catalogo">
            Catálogo de ejercicios
          </Link>
        }
      />

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

      <Card className="mt-4">
        <SectionTitle hint="Experimental · API de Garmin">Enviar al reloj</SectionTitle>
        {!todaysTemplate ? (
          <p className="text-body text-ink-muted">
            No hay plantilla para hoy; el envío al reloj usa la plantilla del día.
          </p>
        ) : template.isPending ? (
          <p role="status" className="text-body text-ink-muted">Cargando la plantilla…</p>
        ) : template.isError ? (
          <p role="alert" className="text-body text-danger">{template.error.message}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink-muted">
              Prepara «{todaysTemplate.name}» y revisa el mapeo antes de tocar tu cuenta de Garmin.
              Nada se envía hasta que lo confirmes.
            </p>
            {!sendOpen && push.data === undefined ? (
              <div>
                <Button onClick={startPreview}>Previsualizar envío</Button>
              </div>
            ) : null}

            {push.data?.status === 'dry_run' ? (
              <div className="rounded-md border border-line bg-raised p-3">
                <p className="text-body text-ink">
                  {push.data.blocks} bloques · ~{Math.round(push.data.estimated_seconds / 60)} min ·{' '}
                  {push.data.garmin_catalog_exercises} ejercicios en el catálogo Garmin.
                </p>
                <ul className="mt-2 flex flex-col gap-1 text-caption text-ink-muted">
                  {push.data.mapping.map((item) => (
                    <li key={`${item.name}-${item.exercise}`}>
                      {item.name} → {item.category} / {item.exercise}
                    </li>
                  ))}
                </ul>
                {push.data.unmapped_exercises.length > 0 ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <p role="alert" className="text-caption text-danger">
                      Sin mapeo Garmin: {push.data.unmapped_exercises.join(', ')}. No se enviará nada
                      hasta corregirlo.
                    </p>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSendOpen(false);
                        setConfirmed(false);
                        push.reset();
                      }}
                    >
                      Cerrar
                    </Button>
                  </div>
                ) : (
                  <div className="mt-3 flex flex-col gap-2">
                    <label className="flex items-start gap-2 text-caption text-ink-muted">
                      <input
                        type="checkbox"
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                        className="mt-0.5 size-4 accent-[var(--ga-accent)]"
                      />
                      Entiendo que es experimental y que debo revisarlo en el reloj.
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button onClick={sendForReal} disabled={!confirmed || push.isPending}>
                        {push.isPending ? 'Enviando…' : 'Enviar de verdad'}
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSendOpen(false);
                          setConfirmed(false);
                          push.reset();
                        }}
                      >
                        Cerrar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ) : null}

            {push.data?.status === 'sent' ? (
              <div role="status" className="rounded-md border border-line bg-raised p-3">
                <p className="text-body text-ink">Enviado a Garmin Connect. Falta comprobarlo en el reloj.</p>
                <Button
                  className="mt-2"
                  variant="secondary"
                  onClick={() => {
                    setSendOpen(false);
                    setConfirmed(false);
                    push.reset();
                  }}
                >
                  Cerrar
                </Button>
              </div>
            ) : null}

            {push.isError ? (
              <div className="flex flex-col gap-2">
                <p role="alert" className="text-body text-danger">{push.error.message}</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={startPreview}>Reintentar previsualización</Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSendOpen(false);
                      setConfirmed(false);
                      push.reset();
                    }}
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </Card>

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
            description="Aquí aparecerá cada sesión terminada con su tonelaje, su TSS y su duración real. Las actividades de fuerza de Garmin se pueden importar a demanda (T-30); todavía no es automático."
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
