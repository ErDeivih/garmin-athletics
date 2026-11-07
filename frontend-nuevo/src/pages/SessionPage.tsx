import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronLeft, Flag, TimerReset, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useCreateSession, useLastMarks, useTemplate } from '../api/queries';
import type { SessionDetail, SessionSetInput } from '../api/types';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { ExerciseIllustration } from '../components/ExerciseIllustration';
import { formatNumber } from '../lib/format';

interface DraftSet {
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
  completedAt: string | null;
}

interface DraftExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  restSeconds: number;
  targetSets: number;
  targetReps: number;
  previous: string | null;
  sets: DraftSet[];
}

interface SessionDraft {
  version: 1;
  templateId: string;
  templateName: string;
  startedAt: string;
  restEndsAt: string | null;
  exercises: DraftExercise[];
}

const STORAGE_PREFIX = 'lyfta.session';
const STORAGE_PREFIX_ANTERIOR = 'carga.session';
const STORAGE_PREFIX_LEGACY = 'pulso.session';

const toNumber = (value: string): number => {
  const cleaned = value.replace(',', '.').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const draftKey = (userId: string, templateId: string, prefix = STORAGE_PREFIX) =>
  `${prefix}.${userId}.${templateId}`;

function readDraft(userId: string, templateId: string): SessionDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId, templateId))
      ?? window.localStorage.getItem(draftKey(userId, templateId, STORAGE_PREFIX_ANTERIOR))
      ?? window.localStorage.getItem(draftKey(userId, templateId, STORAGE_PREFIX_LEGACY));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionDraft;
    if (parsed.version !== 1 || parsed.templateId !== templateId || !Array.isArray(parsed.exercises)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(userId: string, draft: SessionDraft): void {
  try {
    window.localStorage.setItem(draftKey(userId, draft.templateId), JSON.stringify(draft));
  } catch {
    // sin almacenamiento: la sesión vive en memoria hasta recargar
  }
}

function clearDraft(userId: string, templateId: string): void {
  try {
    window.localStorage.removeItem(draftKey(userId, templateId));
    window.localStorage.removeItem(draftKey(userId, templateId, STORAGE_PREFIX_ANTERIOR));
    window.localStorage.removeItem(draftKey(userId, templateId, STORAGE_PREFIX_LEGACY));
  } catch {
    // nada que limpiar
  }
}

function buildDraft(
  templateId: string,
  templateName: string,
  exercises: {
    exerciseId: string;
    name: string;
    muscleGroup: string;
    sets: number;
    reps: number;
    weightKg: number;
    restSeconds: number;
  }[],
  marks: Record<string, { weight_kg: number; reps: number; date: string | null } | undefined>,
): SessionDraft {
  return {
    version: 1,
    templateId,
    templateName,
    startedAt: new Date().toISOString(),
    restEndsAt: null,
    exercises: exercises.map((exercise) => {
      const mark = marks[exercise.exerciseId];
      const previous = mark ? `Anterior: ${formatNumber(mark.weight_kg, 'kg')} × ${mark.reps}` : null;
      return {
        exerciseId: exercise.exerciseId,
        name: exercise.name,
        muscleGroup: exercise.muscleGroup,
        restSeconds: exercise.restSeconds,
        targetSets: exercise.sets,
        targetReps: exercise.reps,
        previous,
        sets: Array.from({ length: Math.max(1, exercise.sets) }, () => ({
          weight: String(mark?.weight_kg ?? exercise.weightKg ?? ''),
          reps: String(mark?.reps ?? exercise.reps ?? ''),
          rpe: '',
          done: false,
          completedAt: null,
        })),
      };
    }),
  };
}

function RestTimer({ endsAt, now }: { endsAt: string | null; now: number }) {
  if (!endsAt) return null;
  const ends = new Date(endsAt).getTime();
  const remaining = Math.max(0, Math.ceil((ends - now) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  return (
    <div
      role="status"
      className={`sticky top-14 z-10 mb-4 flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
        remaining > 0 ? 'border-line-strong bg-raised' : 'border-success bg-success-soft'
      }`}
    >
      <span className="flex items-center gap-2 text-caption uppercase tracking-wider text-ink-muted">
        <TimerReset aria-hidden="true" className="size-4" />
        Descanso
      </span>
      <span className={`tnum font-display text-title ${remaining > 0 ? 'text-ink' : 'text-success'}`}>
        {remaining > 0 ? `${minutes}:${String(seconds).padStart(2, '0')}` : 'Listo'}
      </span>
      <span className="text-caption text-ink-faint">
        {remaining > 0 ? 'Sigue aunque bloquees el móvil' : 'Puedes empezar la siguiente serie'}
      </span>
    </div>
  );
}

function SessionSummary({ session }: { session: SessionDetail }) {
  const byMuscle = new Map<string, number>();
  for (const exercise of session.exercises) {
    const group = exercise.exercise?.muscle_group ?? 'sin_clasificar';
    const tonnage = exercise.sets
      .filter((item) => !item.is_warmup)
      .reduce((sum, item) => sum + (item.weight_kg || 0) * (item.reps || 0), 0);
    byMuscle.set(group, (byMuscle.get(group) ?? 0) + tonnage);
  }
  return (
    <>
      <PageHeader
        title="Sesión terminada"
        description={session.name ?? 'Sesión de fuerza'}
        actions={
          <div className="flex flex-wrap gap-2">
            <Link to={`/gimnasio/sesiones/${session.id}`} className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong px-3 text-body font-semibold text-ink">
              Editar pesos reales
            </Link>
            <Link to="/gimnasio" className="focus-ring inline-flex min-h-11 items-center rounded-md bg-accent px-4 text-body font-semibold text-on-accent">
              <ChevronLeft aria-hidden="true" className="size-4" />
              Volver a Gimnasio
            </Link>
          </div>
        }
      />
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3">
        {[
          { label: 'Peso movido', value: formatNumber(session.total_tonnage_kg, 'kg') },
          { label: 'Series', value: String(session.sets_count) },
        ].map((item) => (
          <Card key={item.label}>
            <span className="block text-caption uppercase tracking-wider text-ink-muted">{item.label}</span>
            <span className="tnum font-display text-title text-ink">{item.value}</span>
          </Card>
        ))}
      </section>
      <Card className="mt-3">
        <SectionTitle>Reparto muscular</SectionTitle>
        {byMuscle.size === 0 ? (
          <p className="text-body text-ink-muted">Sin series de trabajo: no hay volumen que repartir.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {[...byMuscle.entries()].sort((a, b) => b[1] - a[1]).map(([group, tonnage]) => (
              <li key={group} className="flex items-center justify-between gap-2 text-body">
                <span className="text-ink">{group}</span>
                <span className="tnum text-ink-muted">{formatNumber(tonnage, 'kg')}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="mt-3">
        <SectionTitle>Series registradas</SectionTitle>
        <ul className="flex flex-col gap-3">
          {session.exercises.map((exercise) => (
            <li key={exercise.exercise?.id ?? exercise.position}>
              <span className="text-body font-semibold text-ink">{exercise.exercise?.name ?? 'Ejercicio'}</span>
              <ul className="mt-1 flex flex-col gap-1">
                {exercise.sets.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-2 text-caption text-ink-muted">
                    <span>Serie {item.set_number}</span>
                    <span className="tnum">
                      {formatNumber(item.weight_kg, 'kg')} × {item.reps}
                      {item.rpe !== null ? ` · esfuerzo ${item.rpe}` : ''}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Card>
      <p className="mt-4 text-caption text-ink-faint">Guardada en tu historial.</p>
    </>
  );
}

export function SessionPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');
  const template = useTemplate(templateId);
  const exerciseIds = useMemo(
    () => (template.data?.exercises ?? []).flatMap((item) => (item.exercise ? [item.exercise.id] : [])),
    [template.data],
  );
  const marks = useLastMarks(exerciseIds);
  const createSession = useCreateSession();

  const [draft, setDraft] = useState<SessionDraft | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [finishError, setFinishError] = useState<string | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [finished, setFinished] = useState<SessionDetail | null>(null);
  const userId = user?.id ?? 'anon';

  // Recupera el borrador del navegador o lo crea desde la plantilla y la última marca.
  useEffect(() => {
    if (finished) return; // la sesión ya se guardó: no recrear el borrador
    if (!templateId || !template.data || draft !== null) return;
    const stored = readDraft(userId, templateId);
    if (stored) {
      setDraft(stored);
      return;
    }
    if (marks.isPending) return;
    const markMap: Record<string, { weight_kg: number; reps: number; date: string | null } | undefined> = {};
    for (const [id, mark] of Object.entries(marks.data?.marks ?? {})) markMap[id] = mark;
    const exercises = template.data.exercises.flatMap((item) =>
      item.exercise
        ? [{
            exerciseId: item.exercise.id,
            name: item.exercise.name,
            muscleGroup: item.exercise.muscle_group,
            sets: item.sets,
            reps: item.reps,
            weightKg: item.weight_kg,
            restSeconds: item.rest_seconds,
          }]
        : [],
    );
    const created = buildDraft(templateId, template.data.name, exercises, markMap);
    setDraft(created);
    writeDraft(userId, created);
  }, [templateId, template.data, marks.isPending, marks.data, draft, userId, finished]);

  // Cada cambio del borrador se persiste: recargar la página no pierde la sesión.
  useEffect(() => {
    if (draft) writeDraft(userId, draft);
  }, [draft, userId]);

  // Reloj del descanso: se recalcula desde la hora absoluta de fin, también tras
  // volver a la pestaña o desbloquear el móvil.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const interval = window.setInterval(tick, 500);
    document.addEventListener('visibilitychange', tick);
    window.addEventListener('focus', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('focus', tick);
    };
  }, []);

  const elapsed = draft ? Math.max(0, Math.floor((now - new Date(draft.startedAt).getTime()) / 1000)) : 0;
  const doneCount = draft?.exercises.reduce(
    (total, exercise) => total + exercise.sets.filter((item) => item.done).length,
    0,
  ) ?? 0;

  const updateSet = (exerciseIndex: number, setIndex: number, patch: Partial<DraftSet>) => {
    setDraft((current) => {
      if (!current) return current;
      const exercises = current.exercises.map((exercise, index) => {
        if (index !== exerciseIndex) return exercise;
        return {
          ...exercise,
          sets: exercise.sets.map((item, indexSet) => (indexSet === setIndex ? { ...item, ...patch } : item)),
        };
      });
      return { ...current, exercises };
    });
  };

  const toggleSet = (exerciseIndex: number, setIndex: number) => {
    setDraft((current) => {
      if (!current) return current;
      const exercise = current.exercises[exerciseIndex];
      const item = exercise?.sets[setIndex];
      if (!exercise || !item) return current;
      const done = !item.done;
      const completedAt = done ? new Date().toISOString() : null;
      const restEndsAt =
        done && exercise.restSeconds > 0
          ? new Date(Date.now() + exercise.restSeconds * 1000).toISOString()
          : current.restEndsAt;
      return {
        ...current,
        restEndsAt,
        exercises: current.exercises.map((entry, index) =>
          index === exerciseIndex
            ? {
                ...entry,
                sets: entry.sets.map((set, indexSet) =>
                  indexSet === setIndex ? { ...set, done, completedAt } : set,
                ),
              }
            : entry,
        ),
      };
    });
  };

  const finish = () => {
    if (!draft) return;
    setFinishError(null);
    const sets: SessionSetInput[] = draft.exercises.flatMap((exercise) =>
      exercise.sets.flatMap((item, index) => {
        const weight = toNumber(item.weight);
        const reps = toNumber(item.reps);
        if (!item.done || weight <= 0 || reps <= 0) return [];
        const rpe = item.rpe === '' ? null : toNumber(item.rpe);
        return [{
          exercise_id: exercise.exerciseId,
          set_number: index + 1,
          weight_kg: weight,
          reps,
          rpe,
          rest_seconds: exercise.restSeconds,
          completed_at: item.completedAt,
        }];
      }),
    );
    if (sets.length === 0) {
      setFinishError('Marca al menos una serie con peso y repeticiones antes de terminar.');
      return;
    }
    createSession.mutate(
      {
        name: draft.templateName,
        template_id: draft.templateId,
        started_at: draft.startedAt,
        finished_at: new Date().toISOString(),
        sets,
      },
      {
        onSuccess: (session) => {
          clearDraft(userId, draft.templateId);
          setFinished(session);
          setDraft(null);
        },
        onError: (cause) => setFinishError(cause.message),
      },
    );
  };

  if (finished) return <SessionSummary session={finished} />;

  if (!templateId) {
    return (
      <>
        <PageHeader title="Entrenar" description="Elige una plantilla para empezar la sesión." />
        <EmptyState
          title="Sin plantilla seleccionada"
          description="Abre una plantilla desde Gimnasio y pulsa Empezar."
          action={
            <Link to="/gimnasio" className="text-body font-semibold text-accent underline">
              Ir a Gimnasio
            </Link>
          }
        />
      </>
    );
  }

  if (template.isPending || (draft === null && marks.isPending)) {
    return (
      <>
        <PageHeader title="Entrenar" description="Preparando la sesión…" />
        <LoadingBlock label="Cargando la plantilla y las últimas marcas" />
      </>
    );
  }

  if (template.isError) {
    return (
      <>
        <PageHeader title="Entrenar" description="No se pudo abrir la plantilla." />
        <ErrorState message={template.error.message} onRetry={() => void template.refetch()} />
      </>
    );
  }

  if (draft === null) {
    return <LoadingBlock label="Preparando la sesión" />;
  }

  return (
    <>
      <PageHeader
        title="Entrenar"
        description={`${draft.templateName} · ${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')} · ${doneCount} ${doneCount === 1 ? 'serie hecha' : 'series hechas'}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              onClick={() => setConfirmDiscard(true)}
              disabled={confirmDiscard}
            >
              <Flag aria-hidden="true" className="size-4" />
              Descartar
            </Button>
            <Button variant="primary" onClick={finish} disabled={createSession.isPending || doneCount === 0}>
              {createSession.isPending ? 'Guardando…' : 'Terminar sesión'}
            </Button>
          </div>
        }
      />

      {confirmDiscard ? (
        <Card className="mb-4 border-danger">
          <p className="mb-3 text-body text-ink">
            ¿Descartar esta sesión? No se guardará.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="danger"
              onClick={() => {
                clearDraft(userId, draft.templateId);
                setDraft(null);
                navigate('/gimnasio');
              }}
            >
              Sí, descartar
            </Button>
            <Button variant="ghost" onClick={() => setConfirmDiscard(false)}>
              Seguir entrenando
            </Button>
          </div>
        </Card>
      ) : null}

      {finishError ? (
        <p role="alert" className="mb-4 rounded-md border border-danger bg-danger-soft px-3 py-2 text-body text-danger">
          {finishError}
        </p>
      ) : null}

      <RestTimer endsAt={draft.restEndsAt} now={now} />

      <div className="flex flex-col gap-4">
        {draft.exercises.map((exercise, exerciseIndex) => {
          const doneInExercise = exercise.sets.filter((item) => item.done).length;
          return (
            <Card key={exercise.exerciseId} as="article">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-heading text-ink">{exercise.name}</h2>
                <Badge tone={doneInExercise === exercise.sets.length ? 'go' : 'idle'}>
                  {doneInExercise}/{exercise.sets.length} series
                </Badge>
              </div>
              <p className="mb-3 text-caption text-ink-faint">
                Objetivo {exercise.targetSets}×{exercise.targetReps} · descanso {exercise.restSeconds}s
                {exercise.previous ? ` · ${exercise.previous}` : ' · sin marca anterior'}
              </p>
              <div className="mb-3">
                <ExerciseIllustration name={exercise.name} muscleGroup={exercise.muscleGroup} compact />
              </div>
              <div className="grid grid-cols-[2.5rem_1fr_1fr_3.4rem_2.75rem] items-end gap-2 text-caption text-ink-muted">
                <span>Serie</span>
                <span>Peso (kg)</span>
                <span>Reps</span>
                <span>Esfuerzo</span>
                <span className="text-right">Hecha</span>
              </div>
              <ul className="mt-1 flex flex-col gap-1">
                {exercise.sets.map((item, setIndex) => (
                  <li
                    key={`${exercise.exerciseId}-${setIndex}`}
                    className={`grid min-w-0 grid-cols-[2.25rem_1fr_1fr_3rem_2.75rem] items-center gap-2 rounded-sm px-1 py-1 ${
                      item.done ? 'bg-accent-soft/40' : ''
                    }`}
                  >
                    <span className="tnum text-caption text-ink-muted">{setIndex + 1}</span>
                    <input
                      aria-label={`Peso serie ${setIndex + 1} de ${exercise.name}`}
                      inputMode="decimal"
                      className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-line-strong bg-raised px-2 text-right text-body text-ink"
                      value={item.weight}
                      onChange={(event) => updateSet(exerciseIndex, setIndex, { weight: event.target.value })}
                    />
                    <input
                      aria-label={`Reps serie ${setIndex + 1} de ${exercise.name}`}
                      inputMode="numeric"
                      className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-line-strong bg-raised px-2 text-right text-body text-ink"
                      value={item.reps}
                      onChange={(event) => updateSet(exerciseIndex, setIndex, { reps: event.target.value })}
                    />
                    <select
                      aria-label={`Esfuerzo serie ${setIndex + 1} de ${exercise.name}`}
                      className="focus-ring min-h-11 w-full min-w-0 rounded-md border border-line-strong bg-raised px-1 text-body text-ink"
                      value={item.rpe}
                      onChange={(event) => updateSet(exerciseIndex, setIndex, { rpe: event.target.value })}
                    >
                      <option value="">—</option>
                      {[6, 7, 8, 9, 10].map((value) => (
                        <option key={value} value={String(value)}>
                          {value}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.done}
                      aria-label={`Serie ${setIndex + 1} de ${exercise.name}`}
                      onClick={() => toggleSet(exerciseIndex, setIndex)}
                      className={`focus-ring grid size-11 place-items-center rounded-md border ${
                        item.done
                          ? 'border-success bg-success text-on-accent'
                          : 'border-line-strong bg-raised text-ink-muted'
                      }`}
                    >
                      {item.done ? <Check aria-hidden="true" className="size-5" /> : <span aria-hidden="true" className="size-5" />}
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setConfirmDiscard(true)}>
          <Trash2 aria-hidden="true" className="size-4" />
          Descartar sesión
        </Button>
        <Button variant="primary" onClick={finish} disabled={createSession.isPending || doneCount === 0}>
          {createSession.isPending ? 'Guardando…' : 'Terminar sesión'}
        </Button>
      </div>
    </>
  );
}
