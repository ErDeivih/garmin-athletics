import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCreateCalendarEvent, useDuplicateTemplate, useTemplate, useTemplates } from '../../api/queries';
import { apiFetch } from '../../api/client';
import { Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../../components/ui';
import type { TemplateExercise } from '../../api/types';
import { formatMinutes } from '../../lib/format';
import { buildPlanExport, downloadJson, parsePlansJson } from '../../lib/planes';
import { formatWeight, useWeightUnit } from '../../lib/units';

const FOCUS_ORDER = ['Push', 'Pull', 'Legs', 'Full Body'];
const FOCUS_LABEL: Record<string, string> = {
  Push: 'Empuje',
  Pull: 'Tirón',
  Legs: 'Pierna',
  'Full Body': 'Cuerpo completo',
};

function phaseFor(index: number, total: number): { label: string; hint: string } {
  if (total === 1) return { label: 'Bloque principal', hint: 'Series de trabajo con el peso indicado.' };
  if (total === 2) {
    return index === 0
      ? { label: 'Activación', hint: 'Prepara la articulación y el patrón.' }
      : { label: 'Bloque principal', hint: 'Series de trabajo con el peso indicado.' };
  }
  if (index === 0) return { label: 'Activación', hint: 'Prepara la articulación y el patrón.' };
  if (index === total - 1) return { label: 'Cierre', hint: 'Termina con control y sin prisa.' };
  return { label: 'Bloque principal', hint: 'Series de trabajo con el peso indicado.' };
}

function focusKey(focus: string | null): string {
  const value = (focus ?? '').toLowerCase();
  return FOCUS_ORDER.find((item) => item.toLowerCase() === value) ?? focus ?? '';
}

function groupPhases(exercises: TemplateExercise[]): { label: string; hint: string; items: TemplateExercise[] }[] {
  const groups: { label: string; hint: string; items: TemplateExercise[] }[] = [];
  exercises.forEach((exercise, index) => {
    const phase = phaseFor(index, exercises.length);
    const current = groups.find((group) => group.label === phase.label);
    if (current) {
      current.items.push(exercise);
    } else {
      groups.push({ ...phase, items: [exercise] });
    }
  });
  return groups;
}

const controlClass =
  'focus-ring min-h-11 w-full rounded-md border border-line-strong bg-raised px-2 text-body text-ink';

export function LibraryPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [focusFilter, setFocusFilter] = useState('all');
  const [texto, setTexto] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [aviso, setAviso] = useState<string | null>(null);

  // Dos consultas: todas (para los chips de foco) y la que filtra el servidor.
  const todas = useTemplates();
  const filtradas = useTemplates({
    q: texto,
    focus: focusFilter === 'all' ? undefined : focusFilter,
    from: desde || undefined,
    to: hasta || undefined,
  });
  const duplicar = useDuplicateTemplate();
  const selected = useTemplate(selectedId);
  const queryClient = useQueryClient();
  const unit = useWeightUnit();
  const [importando, setImportando] = useState(false);
  const [fechaAplicar, setFechaAplicar] = useState('');
  const crearEvento = useCreateCalendarEvent();

  /** Aplica la plantilla a un día concreto: crea el evento de calendario. */
  const aplicarAlDia = (templateId: string, nombre: string) => {
    if (!fechaAplicar) return;
    setAviso(null);
    crearEvento.mutate({
      title: nombre,
      event_type: 'strength',
      start_local: `${fechaAplicar}T18:00:00`,
      duration_min: 60,
      weekday: null,
      template_id: templateId,
    }, { onSuccess: () => setAviso('Añadido al calendario') });
  };

  const exportar = () => {
    const planes = todas.data?.items ?? [];
    if (planes.length === 0) {
      setAviso('No hay planes que exportar.');
      return;
    }
    const datos = buildPlanExport(planes);
    const fecha = new Date().toISOString().slice(0, 10);
    downloadJson(`lyfta-planes-${fecha}.json`, datos);
    setAviso(planes.length === 1 ? '1 plan exportado' : `${planes.length} planes exportados`);
  };

  const importar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = event.target.files?.[0];
    event.target.value = '';
    if (!archivo) return;
    setImportando(true);
    setAviso(null);
    try {
      const { templates, error } = parsePlansJson(await archivo.text());
      if (error) {
        setAviso(error);
        return;
      }
      for (const plan of templates) {
        await apiFetch('/api/v1/strength/templates', { method: 'POST', body: plan });
      }
      await queryClient.invalidateQueries({ queryKey: ['strength', 'templates'] });
      setAviso(templates.length === 1 ? '1 plan importado' : `${templates.length} planes importados`);
    } catch {
      setAviso('No se pudo importar el fichero.');
    } finally {
      setImportando(false);
    }
  };

  const hayFiltros = Boolean(texto.trim() || desde || hasta || focusFilter !== 'all');
  const limpiar = () => {
    setTexto('');
    setDesde('');
    setHasta('');
    setFocusFilter('all');
  };

  if (filtradas.isPending) return <LoadingBlock label="Cargando la biblioteca" />;
  if (filtradas.isError) {
    return <ErrorState message="No se pudo cargar la biblioteca." onRetry={() => void filtradas.refetch()} />;
  }

  const items = [...filtradas.data.items].sort((a, b) => {
    const fa = FOCUS_ORDER.indexOf(focusKey(a.focus));
    const fb = FOCUS_ORDER.indexOf(focusKey(b.focus));
    return (fa === -1 ? 9 : fa) - (fb === -1 ? 9 : fb) || a.name.localeCompare(b.name);
  });
  const focuses = Array.from(new Set((todas.data?.items ?? []).map((item) => focusKey(item.focus)).filter(Boolean)));

  return (
    <>
      <PageHeader
        title="Biblioteca"
        description="Tus planes, con búsqueda, foco y fecha. Duplica uno para reutilizarlo."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={exportar}>Exportar planes</Button>
            <label
              htmlFor="importar-planes"
              className="focus-ring inline-flex min-h-11 cursor-pointer items-center rounded-md border border-line-strong px-3 text-body font-semibold text-ink"
            >
              {importando ? 'Importando…' : 'Importar planes'}
            </label>
            <input
              id="importar-planes"
              type="file"
              accept="application/json,.json"
              aria-label="Importar planes"
              className="sr-only"
              onChange={importar}
            />
            <Link to="/gimnasio" className="text-body font-semibold text-accent underline">Gimnasio</Link>
          </div>
        }
      />

      {aviso ? (
        <p role="status" className="mb-3 rounded-md border border-success/40 bg-success/10 px-3 py-2 text-body text-ink">
          {aviso}
        </p>
      ) : null}

      {(todas.data?.total ?? 0) === 0 ? (
        <EmptyState title="Sin rutinas" description="Cuando crees una plantilla, aquí aparecerá ordenada por foco." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              Buscar por nombre
              <input
                type="search"
                aria-label="Buscar por nombre"
                value={texto}
                onChange={(event) => setTexto(event.target.value)}
                placeholder="Empuje, pierna…"
                className={controlClass}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Desde
                <input
                  type="date"
                  aria-label="Desde"
                  value={desde}
                  onChange={(event) => setDesde(event.target.value)}
                  className={controlClass}
                />
              </label>
              <label className="flex flex-col gap-1 text-caption text-ink-muted">
                Hasta
                <input
                  type="date"
                  aria-label="Hasta"
                  value={hasta}
                  onChange={(event) => setHasta(event.target.value)}
                  className={controlClass}
                />
              </label>
            </div>
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
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-caption text-ink-faint">
                {items.length} de {todas.data?.total ?? 0} planes
              </p>
              {hayFiltros ? (
                <Button variant="secondary" onClick={limpiar}>Quitar filtros</Button>
              ) : null}
            </div>
            {items.length === 0 ? (
              <EmptyState
                title="Sin resultados"
                description="Prueba otro nombre, otro foco o un rango de fechas más amplio."
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {items.map((template) => (
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
                          <Badge tone="info">{FOCUS_LABEL[focusKey(template.focus)] ?? (focusKey(template.focus) || 'General')}</Badge>
                        </div>
                        <p className="mt-1 text-caption text-ink-muted">
                          {template.total_sets} series · {formatWeight(template.estimated_tonnage_kg, unit)} de volumen
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
                <div className="mt-3 flex flex-col gap-4">
                  {groupPhases(selected.data.exercises).map((group) => (
                    <section key={group.label} aria-label={group.label}>
                      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2 border-b border-line pb-1">
                        <div>
                          <h3 className="text-caption font-semibold uppercase tracking-wider text-accent">{group.label}</h3>
                          <p className="text-caption text-ink-muted">{group.hint}</p>
                        </div>
                        <span className="tnum text-caption text-ink-faint">
                          {group.items.reduce((total, item) => total + item.sets, 0)} series
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {group.items.map((item) => {
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
                                <h4 className="text-heading text-ink">{item.exercise?.name ?? 'Ejercicio'}</h4>
                                <span className="tnum text-caption text-ink-muted">
                                  {item.sets} × {item.reps} {item.weight_kg ? `· ${formatWeight(item.weight_kg, unit)}` : ''}
                                </span>
                              </div>
                              <div className="mt-2 grid gap-1 sm:grid-cols-2">
                                {targets.map((target) => (
                                  <div key={target.set_number} className="flex items-center justify-between rounded-sm border border-line/70 bg-surface px-2 py-1.5 text-caption">
                                    <span className="text-ink-faint">Serie {target.set_number}</span>
                                    <span className="tnum font-semibold text-ink">
                                      {target.weight_kg ? `${formatWeight(target.weight_kg, unit)} × ${target.reps}` : `corporal × ${target.reps}`}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <p className="mt-2 text-caption text-ink-faint">
                                Volumen {formatWeight(volume, unit)} · descanso {item.rest_seconds}s
                                {item.exercise ? ` · ${item.exercise.equipment}` : ''}
                                {item.notes ? ` · ${item.notes}` : ''}
                              </p>
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link to={`/gimnasio/entrenar?template=${selected.data.id}`} className="focus-ring inline-flex min-h-11 items-center rounded-md bg-accent px-3 text-body font-semibold text-on-accent">
                    Empezar esta sesión
                  </Link>
                  <Button
                    variant="secondary"
                    aria-label={`Duplicar plan ${selected.data.name}`}
                    disabled={duplicar.isPending}
                    onClick={() => {
                      setAviso(null);
                      duplicar.mutate(selected.data!.id, {
                        onSuccess: (copia) => {
                          setSelectedId(copia.id);
                          setAviso('Copia creada');
                        },
                      });
                    }}
                  >
                    {duplicar.isPending ? 'Duplicando…' : 'Duplicar plan'}
                  </Button>
                  <label className="flex flex-col gap-1 text-caption text-ink-muted">
                    Día para aplicarla
                    <input
                      type="date"
                      aria-label="Día para aplicarla"
                      value={fechaAplicar}
                      onChange={(event) => setFechaAplicar(event.target.value)}
                      className={`${controlClass} w-auto`}
                    />
                  </label>
                  <Button
                    variant="secondary"
                    disabled={!fechaAplicar || crearEvento.isPending}
                    onClick={() => aplicarAlDia(selected.data!.id, selected.data!.name)}
                  >
                    {crearEvento.isPending ? 'Aplicando…' : 'Aplicar al día'}
                  </Button>
                  <Link to={`/gimnasio/catalogo`} className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong px-3 text-body font-semibold text-ink">
                    Ver ejercicios
                  </Link>
                </div>
                {duplicar.isError ? (
                  <p role="alert" className="mt-2 text-caption text-danger">No se pudo duplicar el plan.</p>
                ) : null}
              </Card>
            )}
          </div>
        </div>
      )}
    </>
  );
}
