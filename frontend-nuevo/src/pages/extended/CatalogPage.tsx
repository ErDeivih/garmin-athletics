import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useExercises } from '../../api/queries';
import { EmptyState, ErrorState, LoadingBlock, PageHeader } from '../../components/ui';
import { ExerciseIllustration } from '../../components/ExerciseIllustration';

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState('');
  const exercises = useExercises(search, muscle, '');
  const filters = exercises.data;

  return (
    <>
      <PageHeader
        title="Catálogo"
        description="Ejercicios disponibles, con su dibujo de inicio y fin de movimiento."
        actions={
          <Link to="/gimnasio" className="text-body font-semibold text-accent underline">
            Volver a Gimnasio
          </Link>
        }
      />

      <section aria-label="Filtros" className="mb-4 flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-1 flex-col gap-1 text-caption text-ink-muted">
          Buscar
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Press, sentadilla, remo…"
            className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink placeholder:text-ink-faint"
          />
        </label>
        <label className="flex flex-col gap-1 text-caption text-ink-muted">
          Grupo muscular
          <select
            value={muscle}
            onChange={(event) => setMuscle(event.target.value)}
            className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink"
          >
            <option value="">Todos</option>
            {(filters?.muscle_groups ?? []).map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {exercises.isPending ? (
        <LoadingBlock label="Cargando el catálogo" />
      ) : exercises.isError ? (
        <ErrorState message={exercises.error.message} onRetry={() => void exercises.refetch()} />
      ) : exercises.data.items.length === 0 ? (
        <EmptyState
          title="Sin resultados"
          description="No hay ejercicios que coincidan con la búsqueda. Prueba otro término."
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {exercises.data.items.map((exercise) => (
            <li key={exercise.id} className="rounded-lg border border-line bg-surface p-3 shadow-sm">
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h2 className="text-heading text-ink">{exercise.name}</h2>
                <span className="text-caption text-ink-faint">{exercise.muscle_group_label}</span>
              </div>
              <ExerciseIllustration
                name={exercise.name}
                watchEnum={exercise.garmin_enum}
                muscleGroup={exercise.muscle_group_label}
                compact
              />
              <p className="mt-2 text-caption text-ink-muted">
                {exercise.equipment_label}
                {exercise.is_timed ? ' · por tiempo' : ''}
                {exercise.is_unilateral ? ' · unilateral' : ''}
              </p>
              {exercise.notes ? <p className="mt-1 text-caption text-ink-faint">{exercise.notes}</p> : null}
              <Link
                to={`/gimnasio/ejercicios/${exercise.id}/deteccion`}
                className="focus-ring mt-2 inline-flex min-h-11 items-center text-caption font-semibold text-accent underline"
              >
                Configurar detección
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
