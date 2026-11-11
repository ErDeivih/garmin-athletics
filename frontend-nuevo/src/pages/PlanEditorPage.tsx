import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Copy, Minus, Plus } from 'lucide-react';
import { useLastMarks, useTemplate, useUpdateTemplate } from '../api/queries';
import { Button, Card, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';
import { fromKg, stepFor, toKg, useWeightUnit } from '../lib/units';

type Target = { set_number: number; reps: number; weight_kg: number };
type DraftExercise = {
  exercise_id: string;
  name: string;
  sets: number;
  reps: number;
  weight_kg: number;
  rest_seconds: number;
  targets: Target[];
};

export function PlanEditorPage() {
  const { id } = useParams<{ id: string }>();
  const template = useTemplate(id ?? null);
  const update = useUpdateTemplate(id ?? null);
  const [draft, setDraft] = useState<DraftExercise[] | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [enBloque, setEnBloque] = useState<Record<string, string>>({});
  // Texto en edición por fila: tocar el peso y salir del campo lo guarda.
  const [textos, setTextos] = useState<Record<string, string>>({});
  const unit = useWeightUnit();
  const step = stepFor(unit);
  const first = useRef(true);
  const lastPayload = useRef('');

  const exerciseIds = template.data?.exercises.map((item) => item.exercise?.id ?? '') ?? [];
  const marks = useLastMarks(exerciseIds);

  useEffect(() => {
    if (!template.data) return;
    const markMap = marks.data?.marks ?? {};
    setDraft(template.data.exercises.map((item) => {
      const existing = item.set_targets?.length ? item.set_targets : [];
      const lastWeight = item.exercise ? markMap[item.exercise.id]?.weight_kg : undefined;
      return {
        exercise_id: item.exercise?.id ?? '',
        name: item.exercise?.name ?? 'Ejercicio',
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        rest_seconds: item.rest_seconds,
        targets: Array.from({ length: item.sets }, (_, index) => ({
          set_number: index + 1,
          reps: existing[index]?.reps ?? item.reps,
          weight_kg: existing[index]?.weight_kg ?? lastWeight ?? item.weight_kg ?? 0,
        })),
      };
    }));
  }, [template.data, marks.data]);

  const payload = useMemo(() => {
    if (!template.data || !draft) return null;
    return {
      name: template.data.name,
      weekday: template.data.weekday,
      focus: template.data.focus,
      notes: template.data.notes,
      exercises: draft.map((item) => ({
        exercise_id: item.exercise_id,
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.targets[0]?.weight_kg ?? item.weight_kg,
        rest_seconds: item.rest_seconds,
        set_targets: item.targets,
      })),
    };
  }, [template.data, draft]);

  useEffect(() => {
    if (!payload) return;
    const serialized = JSON.stringify(payload);
    if (first.current) {
      first.current = false;
      lastPayload.current = serialized;
      return;
    }
    if (serialized === lastPayload.current) return;
    lastPayload.current = serialized;
    const timer = window.setTimeout(() => {
      update.mutate(payload, { onSuccess: () => setSavedAt(new Date().toLocaleTimeString()) });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [payload]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Peso editable en la propia fila (sin abrir otra pantalla). */
  const claveTexto = (exerciseIndex: number, setIndex: number) => `${exerciseIndex}-${setIndex}`;

  const textoPeso = (exerciseIndex: number, setIndex: number, target: Target): string =>
    textos[claveTexto(exerciseIndex, setIndex)]
    ?? String(fromKg(target.weight_kg, unit)).replace('.', ',');

  const escribirPeso = (exerciseIndex: number, setIndex: number, value: string) => {
    setTextos((current) => ({ ...current, [claveTexto(exerciseIndex, setIndex)]: value }));
  };

  const guardarPesoEscrito = (exerciseIndex: number, setIndex: number) => {
    const clave = claveTexto(exerciseIndex, setIndex);
    const crudo = textos[clave];
    setTextos((current) => {
      const copia = { ...current };
      delete copia[clave];
      return copia;
    });
    if (crudo === undefined) return;
    const valor = Number(crudo.replace(',', '.').trim());
    if (!Number.isFinite(valor) || valor < 0) return;
    const enKg = toKg(valor, unit);
    setDraft((current) => current?.map((item, index) => {
      if (index !== exerciseIndex) return item;
      return {
        ...item,
        targets: item.targets.map((target, targetIndex) =>
          targetIndex === setIndex ? { ...target, weight_kg: enKg } : target),
      };
    }) ?? null);
  };

  const changeWeight = (exerciseIndex: number, setIndex: number, delta: number) => {
    setDraft((current) => current?.map((item, index) => {
      if (index !== exerciseIndex) return item;
      return {
        ...item,
        targets: item.targets.map((target, targetIndex) => {
          if (targetIndex !== setIndex) return target;
          // El valor se edita en la unidad elegida; se guarda siempre en kg.
          const enUnidad = Math.round((fromKg(target.weight_kg, unit) + delta) * 10) / 10;
          return { ...target, weight_kg: toKg(Math.max(0, enUnidad), unit) };
        }),
      };
    }) ?? null);
  };

  /** Copia peso y reps de la serie anterior: el salto entre series se teclea una vez. */
  const copyPrevious = (exerciseIndex: number, setIndex: number) => {
    if (setIndex === 0) return;
    setDraft((current) => current?.map((item, index) => {
      if (index !== exerciseIndex) return item;
      const anterior = item.targets[setIndex - 1];
      if (!anterior) return item;
      return {
        ...item,
        targets: item.targets.map((target, targetIndex) =>
          targetIndex === setIndex
            ? { ...target, weight_kg: anterior.weight_kg, reps: anterior.reps }
            : target),
      };
    }) ?? null);
  };

  /** Pone el mismo peso en todas las series del ejercicio. */
  const applyAll = (exerciseIndex: number, weightKg: number) => {
    setDraft((current) => current?.map((item, index) => {
      if (index !== exerciseIndex) return item;
      return {
        ...item,
        targets: item.targets.map((target) => ({ ...target, weight_kg: weightKg })),
      };
    }) ?? null);
  };

  const pesoEnBloque = (exercise: DraftExercise) => enBloque[exercise.exercise_id] ?? '';
  const aplicarEnBloque = (exerciseIndex: number, exercise: DraftExercise) => {
    const valor = Number(pesoEnBloque(exercise).replace(',', '.'));
    if (!Number.isFinite(valor) || valor < 0) return;
    applyAll(exerciseIndex, toKg(valor, unit));
  };

  if (template.isPending) return <LoadingBlock label="Cargando el plan" />;
  if (template.isError || !template.data) {
    return <><PageHeader title="Editar plan" /><ErrorState message="No se pudo cargar el plan." onRetry={() => void template.refetch()} /></>;
  }

  return (
    <>
      <PageHeader
        title="Editar pesos"
        description={`${template.data.name} · toca − o + en cada serie`}
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />
      <p className="mb-3 text-caption text-ink-muted">
        {update.isPending ? 'Guardando…' : savedAt ? `Guardado a las ${savedAt}` : 'Los cambios se guardan solos.'}
      </p>
      <div className="flex flex-col gap-3">
        {(draft ?? []).map((exercise, exerciseIndex) => (
          <Card key={exercise.exercise_id} as="section">
            <SectionTitle hint={`${exercise.sets} × ${exercise.reps}`}>{exercise.name}</SectionTitle>
            <div className="mb-3 flex flex-wrap items-end gap-2 rounded-md border border-line bg-raised/60 p-2">
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Todas las series ({unit})
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="2.5"
                  aria-label={`Peso para todas las series de ${exercise.name}`}
                  value={pesoEnBloque(exercise)}
                  onChange={(event) => setEnBloque((actual) => ({
                    ...actual,
                    [exercise.exercise_id]: event.target.value,
                  }))}
                  className="focus-ring min-h-11 w-28 rounded-md border border-line-strong bg-raised px-2 text-right text-body text-ink"
                />
              </label>
              <Button
                variant="secondary"
                onClick={() => aplicarEnBloque(exerciseIndex, exercise)}
              >
                Aplicar a todas
              </Button>
              <span className="text-caption text-ink-faint">Un peso para las {exercise.sets} series</span>
            </div>
            <div className="flex flex-col gap-2">
              {exercise.targets.map((target, setIndex) => (
                <div key={target.set_number} className="flex items-center justify-between gap-3 rounded-md border border-line bg-raised px-3 py-2">
                  <span className="text-body text-ink">Serie {target.set_number}</span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      className="size-11 p-0"
                      aria-label={`Copiar peso de la serie anterior a la serie ${target.set_number} de ${exercise.name}`}
                      disabled={setIndex === 0}
                      onClick={() => copyPrevious(exerciseIndex, setIndex)}
                    >
                      <Copy aria-hidden="true" className="size-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      className="size-11 p-0"
                      aria-label={`Bajar peso serie ${target.set_number} de ${exercise.name}`}
                      onClick={() => changeWeight(exerciseIndex, setIndex, -step)}
                    >
                      <Minus aria-hidden="true" className="size-5" />
                    </Button>
                    <input
                      aria-label={`Peso serie ${target.set_number} de ${exercise.name}`}
                      inputMode="decimal"
                      value={textoPeso(exerciseIndex, setIndex, target)}
                      onChange={(event) => escribirPeso(exerciseIndex, setIndex, event.target.value)}
                      onBlur={() => guardarPesoEscrito(exerciseIndex, setIndex)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur();
                      }}
                      className="tnum focus-ring min-h-11 w-24 rounded-md border border-line-strong bg-raised px-2 text-center font-display text-title text-ink"
                    />
                    <Button
                      variant="secondary"
                      className="size-11 p-0"
                      aria-label={`Subir peso serie ${target.set_number} de ${exercise.name}`}
                      onClick={() => changeWeight(exerciseIndex, setIndex, step)}
                    >
                      <Plus aria-hidden="true" className="size-5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
      {update.isError ? <p role="alert" className="mt-3 text-body text-danger">No se pudo guardar. Prueba otra vez.</p> : null}
    </>
  );
}
