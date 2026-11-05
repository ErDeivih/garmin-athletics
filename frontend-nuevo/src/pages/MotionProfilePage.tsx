import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  useDeactivateMotionProfile,
  useExerciseDetail,
  useMotionProfile,
  useSaveMotionProfile,
} from '../api/queries';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../components/ui';

type ProfileShape = {
  schema_version?: number;
  sensor?: Record<string, unknown>;
  signal?: Record<string, unknown>;
  axis?: { name?: string; mode?: string; side?: string; sign?: number };
  rep?: {
    expected_duration_s?: number;
    min_duration_s?: number;
    max_duration_s?: number;
    min_peak_distance_s?: number;
    prominence_mg?: number;
    hysteresis_mg?: number;
  };
  set?: {
    min_reps?: number;
    start_after_reps?: number;
    end_rest_s?: number;
    auto_set_detection?: boolean;
  };
  side?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
};

const DEFAULT_PROFILE: ProfileShape = {
  schema_version: 1,
  sensor: { source: 'watch_accelerometer', sample_rate_hz: 25, units: 'milli_g', axes: ['x', 'y', 'z'], max_window_s: 2.0 },
  signal: { mode: 'axis_projected', gravity_removal: 'mean_subtract', smooth_samples: 3, normalize: false },
  axis: { name: 'z', mode: 'calibrated', side: 'watch_arm', sign: 1 },
  rep: {
    expected_duration_s: 2.4,
    min_duration_s: 1.2,
    max_duration_s: 5.0,
    min_peak_distance_s: 0.7,
    prominence_mg: 180,
    hysteresis_mg: 60,
  },
  set: { min_reps: 3, start_after_reps: 2, end_rest_s: 8, auto_set_detection: true },
  side: { mode: 'unilateral', counts: 'watch_arm_only', mirror_when_left: true },
  confidence: { min_interval_ratio: 0.65, max_interval_ratio: 1.5, min_reps_before_review: 2 },
};

function mergeProfile(base: ProfileShape, incoming?: Record<string, unknown> | null): ProfileShape {
  if (!incoming) return base;
  const profile = incoming as ProfileShape;
  return {
    ...base,
    ...profile,
    sensor: { ...base.sensor, ...profile.sensor },
    signal: { ...base.signal, ...profile.signal },
    axis: { ...base.axis, ...profile.axis },
    rep: { ...base.rep, ...profile.rep },
    set: { ...base.set, ...profile.set },
    side: { ...base.side, ...profile.side },
    confidence: { ...base.confidence, ...profile.confidence },
  };
}

export function MotionProfilePage() {
  const { id } = useParams<{ id: string }>();
  const exercise = useExerciseDetail(id ?? null);
  const motion = useMotionProfile(id);
  const save = useSaveMotionProfile(id);
  const deactivate = useDeactivateMotionProfile(id);

  const [profile, setProfile] = useState<ProfileShape>(DEFAULT_PROFILE);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (motion.data?.configured) {
      setProfile(mergeProfile(DEFAULT_PROFILE, motion.data.profile));
    }
  }, [motion.data]);

  if (exercise.isPending || motion.isPending) {
    return <LoadingBlock label="Cargando la detección" />;
  }
  if (exercise.isError || !exercise.data) {
    return (
      <>
        <PageHeader title="Detección" />
        <ErrorState message="No se pudo cargar el ejercicio." onRetry={() => void exercise.refetch()} />
      </>
    );
  }
  if (motion.isError) {
    return (
      <>
        <PageHeader title="Detección" />
        <ErrorState message="No se pudo cargar la configuración." onRetry={() => void motion.refetch()} />
      </>
    );
  }

  const active = motion.data?.configured ?? false;
  const rep = profile.rep ?? {};
  const set = profile.set ?? {};

  const updateRep = (patch: Partial<NonNullable<ProfileShape['rep']>>) =>
    setProfile((current) => ({ ...current, rep: { ...current.rep, ...patch } }));
  const updateSet = (patch: Partial<NonNullable<ProfileShape['set']>>) =>
    setProfile((current) => ({ ...current, set: { ...current.set, ...patch } }));
  const updateAxis = (patch: Partial<NonNullable<ProfileShape['axis']>>) =>
    setProfile((current) => ({ ...current, axis: { ...current.axis, ...patch } }));

  const activate = () => {
    const expected = Number(rep.expected_duration_s ?? 2.4);
    const next: ProfileShape = {
      ...profile,
      schema_version: 1,
      rep: {
        ...rep,
        expected_duration_s: expected,
        min_duration_s: Math.max(0.6, Number((expected * 0.5).toFixed(2))),
        max_duration_s: Math.min(12, Number((expected * 2).toFixed(2))),
        min_peak_distance_s: Math.max(0.3, Number((expected * 0.5).toFixed(2))),
      },
      set: { ...set, min_reps: Number(set.min_reps ?? 3), start_after_reps: Number(set.start_after_reps ?? 2) },
    };
    save.mutate(
      { profile: next as Record<string, unknown>, status: 'active' },
      {
        onSuccess: () => {
          setSaved(true);
          void motion.refetch();
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title="Detección de repeticiones"
        description={exercise.data.exercise.name}
        actions={
          <Link to="/gimnasio/catalogo" className="text-body font-semibold text-accent underline">
            Catálogo
          </Link>
        }
      />

      <Card>
        <SectionTitle hint={active ? 'Activa' : 'Sin configurar'}>Detección</SectionTitle>
        <p className="text-body text-ink-muted">
          {active
            ? 'El reloj puede contar las repeticiones de este ejercicio solo.'
            : 'Configura el movimiento para que el reloj cuente las repeticiones y las series sin tocar el reloj.'}
        </p>
        {active ? (
          <Button
            variant="danger"
            className="mt-3"
            onClick={() => deactivate.mutate(undefined, { onSuccess: () => { setSaved(false); void motion.refetch(); } })}
            disabled={deactivate.isPending}
          >
            {deactivate.isPending ? 'Desactivando…' : 'Desactivar detección'}
          </Button>
        ) : null}
      </Card>

      <Card className="mt-3">
        <SectionTitle hint="Se guarda en tu cuenta">Ajustes</SectionTitle>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            Duración de una repetición (segundos)
            <input
              type="number"
              min={0.5}
              max={12}
              step={0.1}
              value={rep.expected_duration_s ?? 2.4}
              onChange={(event) => updateRep({ expected_duration_s: Number(event.target.value) })}
              className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
            />
          </label>
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            Repeticiones para empezar a contar la serie
            <input
              type="number"
              min={1}
              max={10}
              value={set.start_after_reps ?? 2}
              onChange={(event) => updateSet({ start_after_reps: Number(event.target.value) })}
              className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
            />
          </label>
          <label className="flex items-center gap-2 text-body text-ink">
            <input
              type="checkbox"
              checked={set.auto_set_detection ?? true}
              onChange={(event) => updateSet({ auto_set_detection: event.target.checked })}
              className="size-5 accent-[var(--ga-accent)]"
            />
            Detectar también cuándo empieza y acaba la serie
          </label>
          <details className="rounded-md border border-line bg-raised p-3">
            <summary className="cursor-pointer text-body font-semibold text-ink">Ajustes avanzados</summary>
            <div className="mt-3 flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Eje del movimiento
                <select
                  value={profile.axis?.name ?? 'z'}
                  onChange={(event) => updateAxis({ name: event.target.value })}
                  className="focus-ring min-h-11 rounded-md border border-line-strong bg-surface px-3 text-body text-ink"
                >
                  <option value="x">X</option>
                  <option value="y">Y</option>
                  <option value="z">Z</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Sensibilidad
                <select
                  value={String(rep.prominence_mg ?? 180)}
                  onChange={(event) => updateRep({ prominence_mg: Number(event.target.value) })}
                  className="focus-ring min-h-11 rounded-md border border-line-strong bg-surface px-3 text-body text-ink"
                >
                  <option value="320">Baja (movimientos amplios)</option>
                  <option value="180">Media</option>
                  <option value="90">Alta (movimientos cortos)</option>
                </select>
              </label>
            </div>
          </details>
          <Button variant="primary" onClick={activate} disabled={save.isPending}>
            {save.isPending ? 'Guardando…' : 'Guardar y activar'}
          </Button>
          {saved ? <p role="status" className="text-caption text-success">Detección activada.</p> : null}
          {save.isError ? (
            <p role="alert" className="text-caption text-danger">
              No se pudo guardar. Revisa los valores.
            </p>
          ) : null}
        </div>
      </Card>

      <Card className="mt-3">
        <SectionTitle>Estado</SectionTitle>
        {active ? (
          <p className="text-body text-ink-muted">
            Perfil activo en tu cuenta. Se usará cuando el reloj tenga la detección instalada.
          </p>
        ) : (
          <EmptyState
            title="Conteo manual"
            description="Mientras no haya un perfil activo, las series se marcan a mano en la sesión."
          />
        )}
      </Card>
    </>
  );
}
