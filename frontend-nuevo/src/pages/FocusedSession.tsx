import { useEffect, useState } from 'react';
import { ChevronLeft, Check, X } from 'lucide-react';
import { Button, Card, PageHeader, SectionTitle } from '../components/ui';
import { OfflineBanner } from '../components/SessionBanners';
import { PlateBreakdown } from '../components/PlateBreakdown';
import { repartirDiscos } from '../lib/discos';
import { formatNumber } from '../lib/format';
import { formatWeight, stepFor, toKg, type WeightUnit } from '../lib/units';

/**
 * Modo enfocado para el gimnasio: una sola serie a la vista, botón grande de
 * «Serie hecha», registro rápido de reps/RPE y temporizador de descanso. Se usa
 * con una mano: los controles viven en la franja inferior y no hay listas.
 */
export interface FocusedDraftSet {
  weight: string;
  reps: string;
  rpe: string;
  done: boolean;
  completedAt: string | null;
}

export interface FocusedDraftExercise {
  exerciseId: string;
  name: string;
  muscleGroup: string;
  restSeconds: number;
  targetSets: number;
  targetReps: number;
  previous: string | null;
  sets: FocusedDraftSet[];
}

export interface FocusedDraft {
  templateName: string;
  restEndsAt: string | null;
  exercises: FocusedDraftExercise[];
}

interface Props {
  draft: FocusedDraft;
  now: number;
  unit: WeightUnit;
  offline?: boolean;
  saving: boolean;
  finishError: string | null;
  nota: string;
  onNota: (nota: string) => void;
  onExit: () => void;
  onComplete: (exerciseIndex: number, setIndex: number, patch: Partial<FocusedDraftSet>) => void;
  onWeight: (exerciseIndex: number, setIndex: number, weight: string) => void;
  onSkipRest: () => void;
  onFinish: () => void;
}

const segundos = (restEndsAt: string | null, now: number): number => {
  if (!restEndsAt) return 0;
  return Math.max(0, Math.ceil((new Date(restEndsAt).getTime() - now) / 1000));
};

const reloj = (total: number): string =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

const numero = (texto: string): number => {
  const valor = Number(texto.replace(',', '.'));
  return Number.isFinite(valor) ? valor : 0;
};

const RPE = [6, 7, 8, 9, 10];

/** Primera serie pendiente en orden de ejercicio y serie. */
function serieActual(draft: FocusedDraft): { exerciseIndex: number; setIndex: number } | null {
  for (let e = 0; e < draft.exercises.length; e += 1) {
    const exercise = draft.exercises[e]!;
    for (let s = 0; s < exercise.sets.length; s += 1) {
      if (!exercise.sets[s]!.done) return { exerciseIndex: e, setIndex: s };
    }
  }
  return null;
}

export function FocusedSession({
  draft, now, unit, offline = false, saving, finishError, nota, onNota, onExit, onComplete, onWeight, onSkipRest, onFinish,
}: Props) {
  const actual = serieActual(draft);
  const exercise = actual ? draft.exercises[actual.exerciseIndex]! : null;
  const set = actual && exercise ? exercise.sets[actual.setIndex]! : null;

  const [registrando, setRegistrando] = useState(false);
  const [reps, setReps] = useState('');
  const [rpe, setRpe] = useState<number | null>(null);

  const restante = segundos(draft.restEndsAt, now);
  const serieNumero = actual ? actual.setIndex + 1 : 0;
  const totalSeries = exercise ? exercise.sets.length : 0;
  const hechas = draft.exercises.reduce(
    (total, entry) => total + entry.sets.filter((item) => item.done).length,
    0,
  );
  const total = draft.exercises.reduce((sum, entry) => sum + entry.sets.length, 0);

  // El registro rápido arranca con el objetivo de la serie como repeticiones.
  useEffect(() => {
    setRegistrando(false);
    setReps(set?.reps ?? '');
    setRpe(set && set.rpe !== '' ? Number(set.rpe) : null);
  }, [actual?.exerciseIndex, actual?.setIndex, set?.reps, set?.rpe]);

  const abrirRegistro = () => {
    if (!set) return;
    setReps(set.reps);
    setRpe(set.rpe !== '' ? Number(set.rpe) : null);
    setRegistrando(true);
  };

  const confirmarSerie = () => {
    if (!actual) return;
    onComplete(actual.exerciseIndex, actual.setIndex, {
      reps: String(Math.max(0, Math.round(numero(reps)))),
      rpe: rpe === null ? '' : String(rpe),
    });
    setRegistrando(false);
  };

  return (
    <>
      <PageHeader
        title="Serie en curso"
        description={`${draft.templateName} · ${hechas}/${total} series`}
        actions={
          <button
            type="button"
            onClick={onExit}
            className="focus-ring inline-flex min-h-11 items-center gap-1 rounded-md border border-line-strong px-3 text-body font-semibold text-ink"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
            Volver a la lista
          </button>
        }
      />

      {offline ? <OfflineBanner compact /> : null}

      {actual && exercise && set ? (
        <>
          <Card>
            <p className="text-caption uppercase tracking-wider text-ink-muted">{exercise.muscleGroup}</p>
            <h2 className="mt-1 text-heading text-ink">{exercise.name}</h2>
            <p
              className="mt-1 text-body text-ink-muted"
              aria-label={`Serie ${serieNumero} de ${totalSeries}`}
            >
              Serie <span className="tnum text-ink">{serieNumero}</span> de{' '}
              <span className="tnum text-ink">{totalSeries}</span>
              {exercise.previous ? <span className="block text-caption text-ink-faint">{exercise.previous}</span> : null}
            </p>
            <div className="mt-3 rounded-lg border border-line bg-raised px-4 py-4 text-center">
              <span className="block text-caption uppercase tracking-wider text-ink-muted">Peso objetivo</span>
              <span className="tnum font-display text-display text-ink">
                {formatWeight(numero(set.weight), unit)}
              </span>
              <div className="mt-2 flex items-center justify-center gap-3">
                <button
                  type="button"
                  aria-label="Bajar peso objetivo"
                  onClick={() => onWeight(
                    actual.exerciseIndex,
                    actual.setIndex,
                    String(Number((numero(set.weight) - stepFor(unit)).toFixed(2))),
                  )}
                  className="focus-ring grid size-11 place-items-center rounded-md border border-line-strong text-title text-ink"
                >
                  −
                </button>
                <span className="text-caption text-ink-faint">{stepFor(unit)} {unit}</span>
                <button
                  type="button"
                  aria-label="Subir peso objetivo"
                  onClick={() => onWeight(
                    actual.exerciseIndex,
                    actual.setIndex,
                    String(Number((numero(set.weight) + stepFor(unit)).toFixed(2))),
                  )}
                  className="focus-ring grid size-11 place-items-center rounded-md border border-line-strong text-title text-ink"
                >
                  +
                </button>
              </div>
              <span className="mt-1 block text-body text-ink-muted">× {set.reps} reps</span>
              <PlateBreakdown reparto={repartirDiscos(toKg(numero(set.weight), unit))} />
            </div>
          </Card>

          {registrando ? (
            <Card className="mt-3">
              <SectionTitle hint={`Serie ${serieNumero}`}>Registro rápido</SectionTitle>
              <div className="flex items-center justify-between gap-3">
                <span className="text-body text-ink">Repeticiones reales</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Una repetición menos"
                    onClick={() => setReps(String(Math.max(0, Math.round(numero(reps)) - 1)))}
                    className="focus-ring flex size-12 items-center justify-center rounded-md border border-line-strong text-title text-ink"
                  >
                    −
                  </button>
                  <input
                    aria-label="Repeticiones reales"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={reps}
                    onChange={(event) => setReps(event.target.value)}
                    className="tnum focus-ring min-h-12 w-20 rounded-md border border-line-strong bg-raised px-2 text-center text-title text-ink"
                  />
                  <button
                    type="button"
                    aria-label="Una repetición más"
                    onClick={() => setReps(String(Math.max(0, Math.round(numero(reps)) + 1)))}
                    className="focus-ring flex size-12 items-center justify-center rounded-md border border-line-strong text-title text-ink"
                  >
                    +
                  </button>
                </div>
              </div>

              <p className="mt-3 text-body text-ink">RPE <span className="text-caption text-ink-faint">(opcional)</span></p>
              <div className="mt-1 flex flex-wrap gap-2">
                {RPE.map((valor) => (
                  <button
                    key={valor}
                    type="button"
                    aria-pressed={rpe === valor}
                    aria-label={`RPE ${valor}`}
                    onClick={() => setRpe(rpe === valor ? null : valor)}
                    className={`focus-ring min-h-11 min-w-12 rounded-md border px-3 text-body font-semibold ${
                      rpe === valor ? 'border-accent bg-accent text-on-accent' : 'border-line-strong text-ink'
                    }`}
                  >
                    {valor}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-2">
                <Button className="flex-1" onClick={confirmarSerie}>
                  <Check aria-hidden="true" className="size-4" />
                  Confirmar serie
                </Button>
                <button
                  type="button"
                  aria-label="Cancelar registro"
                  onClick={() => setRegistrando(false)}
                  className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md border border-line-strong px-3 text-body text-ink"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
            </Card>
          ) : (
            <>
              {restante > 0 ? (
                <Card className="mt-3">
                  <SectionTitle hint="temporizador">Descanso</SectionTitle>
                  <p className="tnum font-display text-display text-ink">{reloj(restante)}</p>
                  <p className="text-body text-ink-muted">Cuando termine, pulsa «Serie hecha» otra vez.</p>
                  <Button variant="secondary" className="mt-3" onClick={onSkipRest}>
                    Saltar descanso
                  </Button>
                </Card>
              ) : null}
              <button
                type="button"
                onClick={abrirRegistro}
                disabled={restante > 0}
                className="focus-ring mt-3 flex min-h-16 w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 text-heading font-display text-on-accent disabled:opacity-50"
              >
                <Check aria-hidden="true" className="size-6" />
                Serie hecha
              </button>
              {restante > 0 ? (
                <p className="mt-2 text-center text-caption text-ink-muted">Descansa antes de la siguiente serie.</p>
              ) : (
                <p className="mt-2 text-center text-caption text-ink-faint">
                  Se abre el registro rápido: reps reales y RPE opcional.
                </p>
              )}
            </>
          )}
        </>
      ) : (
        <Card>
          <SectionTitle hint={`${hechas} de ${total}`}>Sesión completada</SectionTitle>
          <p className="text-body text-ink-muted">Las series de esta sesión ya están registradas.</p>
          <label className="mt-3 flex flex-col gap-1 text-caption text-ink-muted">
            Nota (opcional)
            <textarea
              aria-label="Nota (opcional)"
              value={nota}
              onChange={(event) => onNota(event.target.value)}
              rows={3}
              placeholder="Cómo ha ido, sensaciones, algo que repetir…"
              className="focus-ring rounded-md border border-line-strong bg-raised px-3 py-2 text-body text-ink"
            />
          </label>
          <Button className="mt-3 w-full" onClick={onFinish} disabled={saving}>
            {saving ? 'Guardando…' : 'Terminar y guardar'}
          </Button>
        </Card>
      )}

      {finishError ? <p role="alert" className="mt-2 text-body text-danger">{finishError}</p> : null}

      <p className="mt-4 text-caption text-ink-faint">
        {formatNumber(hechas)} de {formatNumber(total)} series · una mano, sin distracciones
      </p>
    </>
  );
}
