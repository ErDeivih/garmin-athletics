import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Minus, Plus } from 'lucide-react';
import { useSession, useUpdateSession } from '../api/queries';
import type { SessionInput, SessionSetInput } from '../api/types';
import { Button, Card, ErrorState, LoadingBlock, PageHeader } from '../components/ui';
import { formatDate, formatNumber } from '../lib/format';

type EditableSet = SessionSetInput & {
  id: string;
  exerciseName: string;
  /** Objetivo del plan para esa serie, para comparar con el peso real. */
  planned_weight_kg: number | null;
  planned_reps: number | null;
};

export function SessionEditPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession(id ?? null);
  const update = useUpdateSession(id ?? null);
  const [sets, setSets] = useState<EditableSet[]>([]);
  const [saved, setSaved] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!session.data) return;
    setSets(session.data.exercises.flatMap((exercise) =>
      exercise.sets.map((item) => ({
        id: item.id,
        exercise_id: item.exercise_id,
        exerciseName: exercise.exercise?.name ?? 'Ejercicio',
        set_number: item.set_number,
        weight_kg: item.weight_kg,
        reps: item.reps,
        rir: item.rir,
        rpe: item.rpe,
        is_warmup: item.is_warmup,
        set_type: item.set_type,
        rest_seconds: item.rest_seconds,
        completed_at: item.completed_at,
        needs_review: item.needs_review,
        planned_weight_kg: item.planned_weight_kg ?? null,
        planned_reps: item.planned_reps ?? null,
      })),
    ));
  }, [session.data]);

  const changeWeight = (index: number, delta: number) => {
    setSets((current) => current.map((row, i) =>
      i === index ? { ...row, weight_kg: Math.max(0, Math.round((row.weight_kg + delta) * 10) / 10) } : row));
    setSaved(false);
    setDirty(true);
  };

  const save = () => {
    if (!session.data) return;
    const payload: SessionInput = {
      name: session.data.name,
      template_id: session.data.template_id,
      started_at: session.data.started_at,
      finished_at: session.data.finished_at,
      notes: session.data.notes,
      sets: sets.map((item) => ({
        exercise_id: item.exercise_id,
        set_number: item.set_number,
        weight_kg: item.weight_kg,
        reps: item.reps,
        rir: item.rir,
        rpe: item.rpe,
        is_warmup: item.is_warmup,
        set_type: item.set_type,
        rest_seconds: item.rest_seconds,
        completed_at: item.completed_at,
        needs_review: item.needs_review,
      })),
    };
    update.mutate(payload, {
      onSuccess: () => {
        setSaved(true);
        setDirty(false);
      },
    });
  };

  useEffect(() => {
    if (!dirty) return;
    const timer = window.setTimeout(save, 450);
    return () => window.clearTimeout(timer);
  }, [dirty, sets]); // eslint-disable-line react-hooks/exhaustive-deps

  if (session.isPending) return <LoadingBlock label="Cargando la sesión" />;
  if (session.isError || !session.data) {
    return (
      <>
        <PageHeader title="Editar sesión" />
        <ErrorState message="No se pudo cargar la sesión." onRetry={() => void session.refetch()} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar pesos reales"
        description={`${session.data.name} · ${formatDate(session.data.date)}`}
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />
      <Card>
        <p className="mb-3 text-body text-ink-muted">
          Ajusta el peso real con − o +. Se guarda solo y recalcula el total.
        </p>
        <div className="flex flex-col gap-2">
          {sets.map((item, index) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
              <div>
                <span className="text-body text-ink">{item.exerciseName}</span>
                <span className="ml-2 text-caption text-ink-faint">Serie {item.set_number}</span>
                {item.planned_weight_kg != null ? (
                  <span className="ml-2 text-caption text-ink-faint">
                    Plan {formatNumber(item.planned_weight_kg, 'kg')}
                    {item.planned_reps != null ? ` × ${item.planned_reps}` : ''}
                  </span>
                ) : null}
                {item.needs_review ? (
                  <span className="ml-2 rounded-sm border border-warning px-1.5 py-0.5 text-caption text-warning">
                    Revisar
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  className="size-11 p-0"
                  aria-label={`Bajar peso serie ${item.set_number} de ${item.exerciseName}`}
                  onClick={() => changeWeight(index, -2.5)}
                >
                  <Minus aria-hidden="true" className="size-5" />
                </Button>
                <span className="tnum min-w-20 text-center font-display text-title text-ink">
                  {formatNumber(item.weight_kg, 'kg')}
                </span>
                <Button
                  variant="secondary"
                  className="size-11 p-0"
                  aria-label={`Subir peso serie ${item.set_number} de ${item.exerciseName}`}
                  onClick={() => changeWeight(index, 2.5)}
                >
                  <Plus aria-hidden="true" className="size-5" />
                </Button>
                <span className="text-caption text-ink-faint">× {item.reps}</span>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3">
            {update.isPending ? (
              <span role="status" className="text-caption text-ink-muted">Guardando…</span>
            ) : saved ? (
              <span role="status" className="text-caption text-success">Guardado.</span>
            ) : (
              <span className="text-caption text-ink-muted">Toca − o + para cambiar una serie.</span>
            )}
          </div>
          {update.isError ? <p role="alert" className="text-caption text-danger">No se pudo guardar.</p> : null}
        </div>
      </Card>
    </>
  );
}
