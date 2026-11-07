import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useSession, useUpdateSession } from '../api/queries';
import type { SessionInput, SessionSetInput } from '../api/types';
import { Button, Card, ErrorState, LoadingBlock, PageHeader } from '../components/ui';
import { formatDate } from '../lib/format';

type EditableSet = SessionSetInput & { id: string; exerciseName: string };

export function SessionEditPage() {
  const { id } = useParams<{ id: string }>();
  const session = useSession(id ?? null);
  const update = useUpdateSession(id ?? null);
  const [sets, setSets] = useState<EditableSet[]>([]);
  const [saved, setSaved] = useState(false);

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
      })),
    ));
  }, [session.data]);

  if (session.isPending) return <LoadingBlock label="Cargando la sesión" />;
  if (session.isError || !session.data) {
    return (
      <>
        <PageHeader title="Editar sesión" />
        <ErrorState message="No se pudo cargar la sesión." onRetry={() => void session.refetch()} />
      </>
    );
  }

  const save = () => {
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
      })),
    };
    update.mutate(payload, { onSuccess: () => setSaved(true) });
  };

  return (
    <>
      <PageHeader
        title="Editar pesos reales"
        description={`${session.data.name} · ${formatDate(session.data.date)}`}
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />
      <Card>
        <p className="mb-3 text-body text-ink-muted">
          Ajusta el peso que realmente usaste en cada serie. El total y las marcas se recalculan al guardar.
        </p>
        <div className="flex flex-col gap-3">
          {sets.map((item, index) => (
            <div key={item.id} className="grid grid-cols-[1fr_6rem_5rem] items-end gap-2 border-t border-line pt-2">
              <div>
                <span className="text-body text-ink">{item.exerciseName}</span>
                <span className="ml-2 text-caption text-ink-faint">Serie {item.set_number}</span>
              </div>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Peso (kg)
                <input
                  type="number"
                  min={0}
                  step="0.5"
                  value={item.weight_kg}
                  onChange={(event) => setSets((current) => current.map((row, i) =>
                    i === index ? { ...row, weight_kg: Number(event.target.value) } : row))}
                  className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-2 text-body text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Reps
                <input
                  type="number"
                  min={0}
                  step="1"
                  value={item.reps}
                  onChange={(event) => setSets((current) => current.map((row, i) =>
                    i === index ? { ...row, reps: Number(event.target.value) } : row))}
                  className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-2 text-body text-ink"
                />
              </label>
            </div>
          ))}
          <div className="flex items-center gap-3">
            <Button variant="primary" onClick={save} disabled={update.isPending}>
              {update.isPending ? 'Guardando…' : 'Guardar pesos reales'}
            </Button>
            {saved ? <span role="status" className="text-caption text-success">Sesión actualizada.</span> : null}
          </div>
          {update.isError ? <p role="alert" className="text-caption text-danger">No se pudo guardar.</p> : null}
        </div>
      </Card>
    </>
  );
}
