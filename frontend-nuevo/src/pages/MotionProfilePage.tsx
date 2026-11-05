import { useState } from 'react';
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
  rep?: Record<string, unknown>;
  set?: Record<string, unknown>;
  side?: Record<string, unknown>;
  confidence?: Record<string, unknown>;
  auto?: boolean;
};

const AUTO_PROFILE: ProfileShape = {
  schema_version: 1,
  auto: true,
  sensor: { source: 'watch_accelerometer', sample_rate_hz: 25, units: 'milli_g', axes: ['x', 'y', 'z'], max_window_s: 2.0 },
  signal: { mode: 'auto', gravity_removal: 'mean_subtract', smooth_samples: 3, normalize: false },
  axis: { name: 'z', mode: 'auto', side: 'watch_arm', sign: 1 },
  rep: { min_duration_s: 0.5, max_duration_s: 8.0, min_peak_distance_s: 0.35, prominence_mg: 120 },
  set: { min_reps: 1, auto_set_detection: true, end_rest_s: 8 },
  side: { mode: 'unilateral', counts: 'watch_arm_only', mirror_when_left: true },
  confidence: { min_interval_ratio: 0.55, max_interval_ratio: 1.8, min_reps_before_review: 1 },
};

export function MotionProfilePage() {
  const { id } = useParams<{ id: string }>();
  const exercise = useExerciseDetail(id ?? null);
  const motion = useMotionProfile(id);
  const save = useSaveMotionProfile(id);
  const deactivate = useDeactivateMotionProfile(id);
  const [profile, setProfile] = useState<ProfileShape>(AUTO_PROFILE);
  const [saved, setSaved] = useState(false);

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

  const activate = () => {
    const next: ProfileShape = {
      ...profile,
      schema_version: 1,
      auto: true,
      rep: {
        ...rep,
        prominence_mg: Number(rep.prominence_mg ?? 120),
        min_peak_distance_s: Number(rep.min_peak_distance_s ?? 0.35),
        min_duration_s: 0.5,
        max_duration_s: 8.0,
      },
      set: { ...profile.set, min_reps: 1, auto_set_detection: true },
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
        <SectionTitle hint={active ? 'Activa' : 'Sin activar'}>Detección automática</SectionTitle>
        <p className="text-body text-ink-muted">
          Cuando empiezas la serie, el reloj detecta el movimiento: marca el inicio y el final de cada
          repetición, mide la velocidad y estima la fuerza. No tienes que configurar duraciones.
        </p>
        {active ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Button
              variant="danger"
              onClick={() => deactivate.mutate(undefined, { onSuccess: () => { setSaved(false); void motion.refetch(); } })}
              disabled={deactivate.isPending}
            >
              {deactivate.isPending ? 'Desactivando…' : 'Desactivar'}
            </Button>
            <span className="text-caption text-ink-faint">La estimación se verá al terminar la serie.</span>
          </div>
        ) : null}
        {!active || saved ? (
          <Button variant="primary" className="mt-3" onClick={activate} disabled={save.isPending}>
            {save.isPending ? 'Activando…' : 'Activar detección automática'}
          </Button>
        ) : null}
        {saved ? <p role="status" className="mt-2 text-caption text-success">Detección activada.</p> : null}
        {save.isError ? (
          <p role="alert" className="mt-2 text-caption text-danger">
            No se pudo activar. Inténtalo otra vez.
          </p>
        ) : null}
      </Card>

      <Card className="mt-3">
        <SectionTitle>Ajuste fino</SectionTitle>
        <details>
          <summary className="cursor-pointer text-body font-semibold text-ink">Solo si el reloj no te cuenta bien</summary>
          <p className="mt-2 text-caption text-ink-muted">
            La mayoría de ejercicios funcionan con la detección automática. Cambia esto solo si faltan
            o sobran repeticiones.
          </p>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              Movimiento
              <select
                value={profile.axis?.name ?? 'z'}
                onChange={(event) => setProfile((current) => ({
                  ...current,
                  axis: { ...current.axis, name: event.target.value },
                }))}
                className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
              >
                <option value="x">Arriba y abajo</option>
                <option value="y">Lateral</option>
                <option value="z">Frontal</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              Sensibilidad
              <select
                value={String(rep.prominence_mg ?? 120)}
                onChange={(event) => setProfile((current) => ({
                  ...current,
                  rep: { ...current.rep, prominence_mg: Number(event.target.value) },
                }))}
                className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
              >
                <option value="240">Suave</option>
                <option value="120">Normal</option>
                <option value="60">Alta</option>
              </select>
            </label>
            <Button variant="secondary" onClick={activate} disabled={save.isPending}>
              Guardar ajuste
            </Button>
          </div>
        </details>
      </Card>

      <Card className="mt-3">
        <SectionTitle>Estado</SectionTitle>
        {active ? (
          <p className="text-body text-ink-muted">
            Activa en tu cuenta. El reloj contará la serie y te dará la estimación de fuerza.
          </p>
        ) : (
          <EmptyState
            title="Conteo manual"
            description="Mientras no la actives, las series se marcan a mano en la sesión."
          />
        )}
      </Card>
    </>
  );
}
