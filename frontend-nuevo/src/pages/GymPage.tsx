import { Link } from 'react-router-dom';
import { CalendarCheck } from 'lucide-react';
import { usePushWorkout, useSessions, useTemplate, useTemplates } from '../api/queries';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { PendingWatchCard } from '../components/PendingWatchCard';
import { AVISO_RELOJ_REAL } from '../config/features';
import { formatDate, formatMinutes, todayWeekday, weekdayName } from '../lib/format';
import { formatWeight, useWeightUnit } from '../lib/units';

const startLink =
  'focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-3 text-body font-semibold text-on-accent';
const secondaryLink =
  'focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong bg-raised px-3 text-body font-semibold text-ink';

/** El gimnasio en una pantalla: qué toca, qué plantillas hay y qué has hecho. */
export function GymPage() {
  const unit = useWeightUnit();
  const templates = useTemplates();
  const sessions = useSessions(5);
  const today = todayWeekday();
  const todaysTemplate = templates.data?.items.find((template) => template.weekday === today) ?? null;
  const template = useTemplate(todaysTemplate?.id ?? null);
  const push = usePushWorkout();

  const startSend = () => {
    if (!template.data) return;
    push.reset();
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
              set_targets: item.set_targets,
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

  return (
    <>
      <PageHeader
        title="Gimnasio"
        description="Tu entreno de hoy, tus plantillas y tu historial."
        actions={
          <div className="flex flex-wrap gap-2">
            <Link className={secondaryLink} to="/gimnasio/biblioteca">
              Biblioteca
            </Link>
            <Link className={secondaryLink} to="/gimnasio/catalogo">
              Catálogo
            </Link>
            <Link className={secondaryLink} to="/gimnasio/progreso">
              Progreso
            </Link>
          </div>
        }
      />

      {AVISO_RELOJ_REAL ? <PendingWatchCard /> : null}

      <section aria-label="Hoy toca">
        <Card>
          <SectionTitle hint={weekdayName(today)}>Hoy toca</SectionTitle>
          {todaysTemplate ? (
            <div className="flex flex-col gap-2">
              <span className="font-display text-title uppercase text-ink">{todaysTemplate.name}</span>
              <p className="text-body text-ink-muted">
                {todaysTemplate.exercises.length} ejercicios · {todaysTemplate.total_sets} series ·{' '}
                {formatWeight(todaysTemplate.estimated_tonnage_kg, unit)}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Link className={startLink} to={`/gimnasio/entrenar?template=${todaysTemplate.id}`}>
                  Empezar sesión
                </Link>
                <Badge tone="info">Series, descanso y esfuerzo</Badge>
              </div>
            </div>
          ) : (
            <p className="text-body text-ink-muted">
              No hay ninguna plantilla asignada a {weekdayName(today).toLowerCase()}.
            </p>
          )}
        </Card>
      </section>

      <Card className="mt-3">
        <SectionTitle>Enviar al reloj</SectionTitle>
        {!todaysTemplate ? (
          <p className="text-body text-ink-muted">Elige un entreno para enviarlo.</p>
        ) : template.isPending ? (
          <p role="status" className="text-body text-ink-muted">Cargando…</p>
        ) : template.isError || !template.data ? (
          <p role="alert" className="text-body text-danger">No se pudo cargar el entreno.</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body text-ink">
                {template.data.exercises.length} ejercicios · {template.data.total_sets} series
              </p>
              <Link to={`/gimnasio/plantillas/${template.data.id}`} className="text-body font-semibold text-accent underline">
                Editar pesos
              </Link>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-caption text-ink-muted">Estado del envío</span>
              <span role="status">
                <Badge tone={push.isError ? 'stop' : push.data?.status === 'sent' ? 'go' : 'idle'}>
                  {push.isPending ? 'Enviando…' : push.isError ? 'Error' : push.data?.status === 'sent' ? 'Enviado' : 'Pendiente'}
                </Badge>
              </span>
            </div>
            <Button onClick={startSend} disabled={push.isPending} className="min-h-12 w-full">
              {push.isPending ? 'Enviando…' : 'Enviar al reloj'}
            </Button>
            {push.data?.status === 'sent' ? (
              <div role="status" className="rounded-md border border-success/40 bg-success/10 p-3">
                <p className="text-body font-semibold text-ink">Enviado al reloj</p>
                <p className="text-caption text-ink-muted">Si no aparece, acerca el reloj y sincroniza.</p>
              </div>
            ) : null}
            {push.isError ? (
              <div role="alert" className="rounded-md border border-danger/40 bg-danger/10 p-3">
                <p className="text-body font-semibold text-ink">No se pudo enviar</p>
                <p className="text-caption text-ink-muted">Acerca el reloj, sincroniza y vuelve a intentarlo.</p>
                <Button variant="secondary" className="mt-2" onClick={startSend}>Reintentar</Button>
              </div>
            ) : null}
            {!push.data && !push.isError && !push.isPending ? (
              <p className="text-caption text-ink-muted">Tú decides cuándo; el reloj solo muestra el objetivo.</p>
            ) : null}
          </div>
        )}
      </Card>

      <section className="mt-4" aria-label="Plantillas">
        <SectionTitle hint={`${templates.data.total} en total`}>Tus plantillas</SectionTitle>
        {templates.data.items.length === 0 ? (
          <EmptyState
            title="Todavía no hay plantillas"
            description="Una plantilla es la rutina que repites: ejercicios, series, peso y descanso."
          />
        ) : (
          <ul className="flex flex-col gap-2">
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
                      {formatWeight(template.estimated_tonnage_kg, unit)}
                    </span>
                    <Link className={secondaryLink} to={`/gimnasio/plantillas/${template.id}`}>
                      Pesos
                    </Link>
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

      <section className="mt-4" aria-label="Últimas sesiones">
        <SectionTitle hint="5 últimas">Últimas sesiones</SectionTitle>
        <div className="mb-2 flex justify-end">
          <Link to="/gimnasio/historial" className="text-caption font-semibold text-accent underline">
            Ver todo el historial
          </Link>
        </div>
        {sessions.data.items.length === 0 ? (
          <EmptyState
            title="Todavía no hay sesiones"
            description="Aquí aparecerá cada sesión terminada con su volumen y su duración."
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
                  <span>{formatWeight(session.total_tonnage_kg, unit)}</span>
                  <span>{session.sets_count} series</span>
                  <span>{formatMinutes(session.duration_min)}</span>
                  <Link to={`/gimnasio/sesiones/${session.id}`} className="font-semibold text-accent underline">
                    Corregir pesos
                  </Link>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
