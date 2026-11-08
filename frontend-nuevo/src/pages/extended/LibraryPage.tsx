import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTemplate, useTemplates } from '../../api/queries';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../../components/ui';
import { formatMinutes, formatNumber } from '../../lib/format';

const FOCUS_ORDER = ['Push', 'Pull', 'Legs', 'Full Body'];
const FOCUS_LABEL: Record<string, string> = {
  Push: 'Empuje',
  Pull: 'Tirón',
  Legs: 'Pierna',
  'Full Body': 'Cuerpo completo',
};

function phaseFor(index: number, total: number): { label: string; hint: string } {
  if (total >= 3 && index === 0) return { label: 'Activación', hint: 'Prepara la articulación y el patrón.' };
  if (total >= 3 && index === total - 1) return { label: 'Cierre', hint: 'Termina con control y sin prisa.' };
  return { label: 'Bloque principal', hint: 'Series de trabajo con el peso indicado.' };
}

export function LibraryPage() {
  const templates = useTemplates();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusFilter, setFocusFilter] = useState('all');
  const selected = useTemplate(selectedId);

  if (templates.isPending) return <LoadingBlock label="Cargando la biblioteca" />;
  if (templates.isError) {
    return <ErrorState message="No se pudo cargar la biblioteca." onRetry={() => void templates.refetch()} />;
  }

  const items = [...templates.data.items].sort((a, b) => {
    const fa = FOCUS_ORDER.indexOf(a.focus ?? '');
    const fb = FOCUS_ORDER.indexOf(b.focus ?? '');
    return (fa === -1 ? 9 : fa) - (fb === -1 ? 9 : fb) || a.name.localeCompare(b.name);
  });
  const focuses = Array.from(new Set(items.map((item) => item.focus).filter(Boolean) as string[]));
  const filtered = focusFilter === 'all' ? items : items.filter((item) => item.focus === focusFilter);

  return (
    <>
      <PageHeader
        title="Biblioteca"
        description="Rutinas ordenadas por foco y fase, con series, peso y descanso."
        actions={<Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>}
      />

      {items.length === 0 ? (
        <EmptyState title="Sin rutinas" description="Cuando crees una plantilla, aquí aparecerá ordenada por foco." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por foco">
              <Button
                variant={focusFilter === 'all' ? 'primary' : 'secondary'}
                aria-pressed={focusFilter === 'all'}
                onClick={() => setFocusFilter('all')}
              >
                Todos
              </Button>
              {focuses.map((focus) => (
                <Button
                  key={focus}
                  variant={focusFilter === focus ? 'primary' : 'secondary'}
                  aria-pressed={focusFilter === focus}
                  onClick={() => setFocusFilter(focus)}
                >
                  {FOCUS_LABEL[focus] ?? focus}
                </Button>
              ))}
            </div>
            {filtered.length === 0 ? (
              <EmptyState title="Sin rutinas de ese foco" description="Prueba otro foco o vuelve a Todos." />
            ) : (
              <ul className="flex flex-col gap-2">
                {filtered.map((template) => (
                  <li key={template.id}>
                    <button type="button" onClick={() => setSelectedId(template.id)} className="focus-ring w-full rounded-lg text-left">
                      <Card as="article" className={selectedId === template.id ? 'border-accent' : ''}>
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h2 className="text-heading text-ink">{template.name}</h2>
                            <p className="text-caption text-ink-faint">
                              {template.weekday_label ?? 'Sin día fijo'} · {template.exercises.length} ejercicios
                            </p>
                          </div>
                          <Badge tone="info">{FOCUS_LABEL[template.focus ?? ''] ?? template.focus ?? 'General'}</Badge>
                        </div>
                        <p className="mt-1 text-caption text-ink-muted">
                          {template.total_sets} series · {formatNumber(template.estimated_tonnage_kg, 'kg')} de volumen
                        </p>
                      </Card>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            {selectedId === null ? (
              <Card className="h-full">
                <SectionTitle>Elige una rutina</SectionTitle>
                <p className="text-body text-ink-muted">Verás sus fases, el peso y las repeticiones de cada ejercicio.</p>
              </Card>
            ) : selected.isPending ? (
              <LoadingBlock label="Cargando la rutina" />
            ) : selected.isError || !selected.data ? (
              <ErrorState message="No se pudo cargar la rutina." onRetry={() => void selected.refetch()} />
            ) : (
              <Card>
                <SectionTitle hint={selected.data.weekday_label ?? undefined}>{selected.data.name}</SectionTitle>
                <p className="text-caption text-ink-muted">
                  {selected.data.exercises.length} ejercicios · {selected.data.total_sets} series ·{' '}
                  {formatMinutes(selected.data.exercises.length * 8)} aprox.
                </p>
                <div className="mt-3 flex flex-col gap-3">
                  {selected.data.exercises.map((item, index) => {
                    const phase = phaseFor(index, selected.data.exercises.length);
                    const targets = item.set_targets?.length
                      ? item.set_targets
                      : Array.from({ length: item.sets }, (_, setIndex) => ({
                          set_number: setIndex + 1,
                          reps: item.reps,
                          weight_kg: item.weight_kg,
                        }));
                    const volume = targets.reduce((total, target) => total + target.weight_kg * target.reps, 0);
                    return (
                      <article key={item.id} className="rounded-md border border-line bg-raised p-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <span className="text-caption font-semibold uppercase tracking-wider text-accent">{phase.label}</span>
                          <span className="tnum text-caption text-ink-muted">
                            {item.sets} × {item.reps} {item.weight_kg ? `· ${item.weight_kg} kg` : ''}
                          </span>
                        </div>
                        <h3 className="text-heading text-ink">{item.exercise?.name ?? 'Ejercicio'}</h3>
                        <p className="text-caption text-ink-muted">{phase.hint}</p>
                        <div className="mt-2 grid gap-1 sm:grid-cols-2">
                          {targets.map((target) => (
                            <div
                              key={target.set_number}
                              className="flex items-center justify-between rounded-sm border border-line/70 bg-surface px-2 py-1.5 text-caption"
                            >
                              <span className="text-ink-faint">Serie {target.set_number}</span>
                              <span className="tnum font-semibold text-ink">
                                {target.weight_kg ? `${formatNumber(target.weight_kg, 'kg')} × ${target.reps}` : ` corporal × ${target.reps}`}
                              </span>
                            </div>
                          ))}
                        </div>
                        <p className="mt-2 text-caption text-ink-faint">
                          Volumen {formatNumber(volume, 'kg')} · descanso {item.rest_seconds}s
                          {item.exercise ? ` · ${item.exercise.equipment}` : ''}
                          {item.notes ? ` · ${item.notes}` : ''}
                        </p>
                      </article>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/gimnasio/entrenar?template=${selected.data.id}`} className="focus-ring inline-flex min-h-11 items-center rounded-md bg-accent px-3 text-body font-semibold text-on-accent">
                    Empezar esta sesión
                  </Link>
                  <Link to={`/gimnasio/catalogo`} className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong px-3 text-body font-semibold text-ink">
                    Ver ejercicios
                  </Link>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
