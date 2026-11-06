import { useMemo, useState } from 'react';
import { useGenerateRoute, useRoute, useRoutes } from '../../api/queries';
import { readToken } from '../../api/token';
import { Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle } from '../../components/ui';
import { formatDate, formatMinutes, formatNumber } from '../../lib/format';

const SPORT_LABEL: Record<string, string> = {
  cycling: 'Bici',
  running: 'Carrera',
  hiking: 'Senderismo',
};

const EFFORT_LABEL: Record<string, string> = {
  easy: 'Suave',
  moderate: 'Medio',
  hard: 'Fuerte',
};

type Point = { lat: number; lon: number; ele?: number | null };
const START: Point = { lat: 40.4168, lon: -3.7038, ele: 650 };

function RouteMap({ lat, lon, checkpoints }: { lat: number[]; lon: number[]; checkpoints?: Point[] }) {
  const points = useMemo(() => {
    if (lat.length < 2) return '';
    const minLat = Math.min(...lat), maxLat = Math.max(...lat);
    const minLon = Math.min(...lon), maxLon = Math.max(...lon);
    const spanLat = maxLat - minLat || 1, spanLon = maxLon - minLon || 1;
    return lat.map((value, index) => {
      const x = 16 + (((lon[index] ?? 0) - minLon) / spanLon) * 568;
      const y = 164 - ((value - minLat) / spanLat) * 148;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(' ');
  }, [lat, lon]);

  return (
    <figure className="m-0">
      <svg role="img" aria-label="Recorrido de la ruta" viewBox="0 0 600 180" className="h-48 w-full rounded-md bg-raised">
        <path d={points} fill="none" stroke="var(--ga-accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {checkpoints?.map((point, index) => {
          const minLat = Math.min(...lat), maxLat = Math.max(...lat);
          const minLon = Math.min(...lon), maxLon = Math.max(...lon);
          const x = 16 + ((point.lon - minLon) / (maxLon - minLon || 1)) * 568;
          const y = 164 - ((point.lat - minLat) / (maxLat - minLat || 1)) * 148;
          return (
            <g key={`${point.lat}-${point.lon}-${index}`}>
              <circle cx={x} cy={y} r="6" fill="var(--ga-surface)" stroke="var(--ga-accent)" strokeWidth="3" />
              <text x={x + 9} y={y + 4} fill="var(--ga-ink-muted)" fontSize="12">{index === 0 ? 'Inicio' : `Paso ${index}`}</text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

function RouteElevation({ ele }: { ele: (number | null)[] }) {
  const values = ele.filter((value): value is number => typeof value === 'number');
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = 600 / (values.length - 1);
  const line = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${(index * step).toFixed(1)} ${(170 - ((value - min) / span) * 130).toFixed(1)}`).join(' ');
  const area = `${line} L600 180 L0 180 Z`;
  return (
    <figure className="m-0">
      <svg role="img" aria-label="Perfil de elevación de la ruta" viewBox="0 0 600 190" className="mt-2 h-40 w-full rounded-md bg-raised">
        <path d={area} fill="var(--ga-accent-soft)" stroke="none" />
        <path d={line} fill="none" stroke="var(--ga-accent)" strokeWidth="3" strokeLinecap="round" />
        <text x="10" y="18" fill="var(--ga-ink-muted)" fontSize="12">{Math.round(max)} m</text>
        <text x="10" y="180" fill="var(--ga-ink-muted)" fontSize="12">{Math.round(min)} m</text>
      </svg>
    </figure>
  );
}

export function RoutesPage() {
  const routes = useRoutes();
  const generate = useGenerateRoute();
  const [name, setName] = useState('Ruta del domingo');
  const [sport, setSport] = useState('running');
  const [distance, setDistance] = useState(8);
  const [effort, setEffort] = useState('moderate');
  const [loop, setLoop] = useState(false);
  const [checkpoints, setCheckpoints] = useState<Point[]>([{ lat: 40.435, lon: -3.69, ele: 700 }]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useRoute(selectedId);

  const updateCheckpoint = (index: number, patch: Partial<Point>) =>
    setCheckpoints((current) => current.map((point, i) => (i === index ? { ...point, ...patch } : point)));

  const addCheckpoint = () =>
    setCheckpoints((current) => [...current, { lat: START.lat + 0.01 * current.length, lon: START.lon + 0.01 * current.length, ele: 680 }]);

  const removeCheckpoint = (index: number) =>
    setCheckpoints((current) => (current.length > 1 ? current.filter((_, i) => i !== index) : current));

  const onGenerate = () => {
    generate.mutate({
      name: name.trim(),
      sport,
      start: START,
      checkpoints,
      distance_km: distance,
      effort,
      loop,
    }, {
      onSuccess: (result) => setSelectedId(result.id),
    });
  };

  const downloadGpx = async () => {
    if (!selectedId) return;
    const token = readToken();
    const response = await fetch(`/api/v1/routes/${selectedId}/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!response.ok) return;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${name || 'ruta'}.gpx`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const generated = selected.data;

  return (
    <>
      <PageHeader title="Rutas" description="Genera recorridos con pasos, desnivel y ritmo por kilómetro." />

      <Card>
        <SectionTitle hint="Diseño de la salida">Nueva ruta</SectionTitle>
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            Nombre
            <input value={name} onChange={(event) => setName(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              Deporte
              <select value={sport} onChange={(event) => setSport(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink">
                <option value="running">Carrera</option>
                <option value="cycling">Bici</option>
                <option value="hiking">Senderismo</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-caption text-ink-muted">
              Kilómetros
              <input type="number" min={1} max={200} value={distance} onChange={(event) => setDistance(Number(event.target.value))} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink" />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-caption text-ink-muted">
            Esfuerzo
            <select value={effort} onChange={(event) => setEffort(event.target.value)} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-3 text-body text-ink">
              <option value="easy">Suave</option>
              <option value="moderate">Medio</option>
              <option value="hard">Fuerte</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-body text-ink">
            <input type="checkbox" checked={loop} onChange={(event) => setLoop(event.target.checked)} className="size-5 accent-[var(--ga-accent)]" />
            Volver al inicio
          </label>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-caption text-ink-muted">Puntos de paso</legend>
            {checkpoints.map((point, index) => (
              <div key={index} className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-caption text-ink-muted">
                  Latitud {index + 1}
                  <input type="number" step="0.0001" value={point.lat} onChange={(event) => updateCheckpoint(index, { lat: Number(event.target.value) })} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-2 text-body text-ink" />
                </label>
                <label className="flex flex-col gap-1 text-caption text-ink-muted">
                  Longitud {index + 1}
                  <input type="number" step="0.0001" value={point.lon} onChange={(event) => updateCheckpoint(index, { lon: Number(event.target.value) })} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-2 text-body text-ink" />
                </label>
                <label className="flex flex-col gap-1 text-caption text-ink-muted">
                  Altitud {index + 1}
                  <input type="number" step="10" value={point.ele ?? 680} onChange={(event) => updateCheckpoint(index, { ele: Number(event.target.value) })} className="focus-ring min-h-11 rounded-md border border-line-strong bg-raised px-2 text-body text-ink" />
                </label>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={addCheckpoint}>Añadir paso</Button>
              <Button variant="ghost" onClick={() => removeCheckpoint(checkpoints.length - 1)} disabled={checkpoints.length <= 1}>
                Quitar último paso
              </Button>
              <Button variant="primary" onClick={onGenerate} disabled={generate.isPending || name.trim().length < 2}>
                {generate.isPending ? 'Generando…' : 'Generar ruta'}
              </Button>
            </div>
          </fieldset>
          {generate.isError ? <p role="alert" className="text-body text-danger">No se pudo generar la ruta.</p> : null}
        </div>
      </Card>

      {generated ? (
        <Card className="mt-3">
          <SectionTitle hint={`${formatNumber(generated.distance_m / 1000, 'km')} · ${formatNumber(generated.gain_m, 'm')} desnivel`}>
            {generated.name}
          </SectionTitle>
          <RouteMap lat={generated.lat} lon={generated.lon} checkpoints={generated.checkpoints} />
          <RouteElevation ele={generated.ele} />
          <div className="mt-2 grid grid-cols-3 gap-2 text-caption">
            <div><span className="block text-ink-faint">Duración</span><span className="text-body text-ink">{formatMinutes((generated.estimated_duration_s ?? generated.splits?.reduce((total, item) => total + item.duration_s, 0) ?? 0) / 60)}</span></div>
            <div><span className="block text-ink-faint">Esfuerzo</span><span className="text-body text-ink">{EFFORT_LABEL[generated.effort ?? 'moderate']}</span></div>
            <div><span className="block text-ink-faint">Perfil</span><span className="text-body text-ink">{SPORT_LABEL[generated.sport] ?? generated.sport}</span></div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" onClick={downloadGpx}>Descargar GPX para el reloj</Button>
            <a href="#ritmo" className="focus-ring inline-flex min-h-11 items-center text-caption font-semibold text-accent underline">Ver ritmo por kilómetro</a>
          </div>
        </Card>
      ) : null}

      {selected.isPending && selectedId ? <LoadingBlock label="Cargando la ruta" /> : null}
      {selected.isError ? <ErrorState message="No se pudo cargar la ruta." onRetry={() => void selected.refetch()} /> : null}

      <section className="mt-4" aria-label="Rutas guardadas">
        <SectionTitle hint={`${routes.data?.length ?? 0} guardadas`}>Tus rutas</SectionTitle>
        {routes.isPending ? (
          <LoadingBlock label="Cargando rutas" />
        ) : routes.isError ? (
          <ErrorState message="No se pudieron cargar las rutas." onRetry={() => void routes.refetch()} />
        ) : routes.data.length === 0 ? (
          <EmptyState title="Todavía no hay rutas" description="Genera una arriba y quedará guardada aquí." />
        ) : (
          <ul className="flex flex-col gap-2">
            {routes.data.map((route) => (
              <li key={route.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(route.id)}
                  className="focus-ring w-full rounded-lg text-left"
                >
                  <Card as="article" className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-heading text-ink">{route.name}</h2>
                      <p className="text-caption text-ink-faint">{SPORT_LABEL[route.sport] ?? route.sport} · {formatDate(route.created_at)}</p>
                    </div>
                    <span className="text-caption text-ink-muted">{formatNumber(route.distance_m / 1000, 'km')} · {formatNumber(route.gain_m, 'm')}</span>
                  </Card>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {generated?.splits?.length ? (
        <section id="ritmo" className="mt-4" aria-label="Ritmo por kilómetro">
          <Card>
            <SectionTitle hint="calculado de la ruta">Ritmo por kilómetro</SectionTitle>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-caption">
                <thead className="text-ink-faint">
                  <tr><th className="py-1">Km</th><th>Ritmo</th><th>Desnivel</th></tr>
                </thead>
                <tbody className="text-ink">
                  {generated.splits.map((split) => (
                    <tr key={split.km} className="border-t border-line">
                      <td className="py-1.5">{split.km}</td>
                      <td>{split.pace ?? `${split.speed_kmh} km/h`}</td>
                      <td>{formatNumber(split.gain_m, 'm')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      ) : null}
    </>
  );
}
