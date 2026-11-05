import { Link, useParams } from 'react-router-dom';
import {
  useActivityDetail,
  useActivitySplits,
  useActivityStreams,
  useActivityTrack,
} from '../../api/queries';
import {
  ActivityStreamChart,
  HrZonesChart,
  LapsList,
  RouteSketch,
  SplitsList,
} from '../../components/charts';
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SectionTitle, StatCard } from '../../components/ui';
import { formatDateTime, formatMinutes, formatNumber } from '../../lib/format';

const TYPE_LABEL: Record<string, string> = {
  running: 'Carrera',
  treadmill_running: 'Cinta',
  trail_running: 'Trail',
  cycling: 'Bici',
  mountain_biking: 'BTT',
  e_bike: 'Bici eléctrica',
  indoor_cycling: 'Bici indoor',
  swimming: 'Natación',
  lap_swimming: 'Natación',
  open_water_swimming: 'Aguas abiertas',
  strength: 'Fuerza',
  strength_training: 'Fuerza',
  soccer: 'Fútbol',
  walking: 'Caminar',
  hiking: 'Senderismo',
  rowing: 'Remo',
  yoga: 'Yoga',
  other: 'Otra',
};

function typeLabel(type: string | undefined): string {
  if (!type) return 'Actividad';
  return TYPE_LABEL[type.toLowerCase()] ?? type;
}

function paceLabel(distanceM: number | null, durationMin: number | null): string | null {
  if (!distanceM || !durationMin) return null;
  const secondsPerKm = (durationMin * 60) / (distanceM / 1000);
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return null;
  const minutes = Math.floor(secondsPerKm / 60);
  const seconds = Math.round(secondsPerKm % 60);
  return `${minutes}:${String(seconds).padStart(2, '0')} /km`;
}

export function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const detail = useActivityDetail(id);
  const hasTrack = Boolean(detail.data?.has_track);
  const streams = useActivityStreams(id, hasTrack);
  const splits = useActivitySplits(id, hasTrack);
  const track = useActivityTrack(id, hasTrack);

  if (detail.isPending) {
    return <LoadingBlock label="Cargando la actividad" />;
  }
  if (detail.isError || !detail.data) {
    return (
      <>
        <PageHeader title="Actividad" />
        <ErrorState message="No se pudo cargar la actividad." onRetry={() => void detail.refetch()} />
      </>
    );
  }

  const activity = detail.data;
  const pace = paceLabel(activity.distance_m, activity.duration_min);
  const sport = activity.type.toLowerCase();
  const showsPace = ['running', 'trail_running', 'walking', 'hiking'].includes(sport);
  const showsSpeed = ['cycling', 'mountain_biking', 'e_bike'].includes(sport);
  const hasElevation = Boolean(streams.data?.ele.some((value) => value !== null));
  const hasSpeed = Boolean(streams.data?.speed_ms.some((value) => (value ?? 0) > 0));
  const stats = [
    activity.distance_m ? { label: 'Distancia', value: formatNumber(activity.distance_m / 1000, 'km') } : null,
    { label: 'Duración', value: formatMinutes(activity.duration_min) },
    pace && showsPace ? { label: 'Ritmo', value: pace } : null,
    activity.avg_hr ? { label: 'FC media', value: formatNumber(activity.avg_hr, 'lpm') } : null,
    activity.max_hr ? { label: 'FC máx.', value: formatNumber(activity.max_hr, 'lpm') } : null,
    activity.avg_cadence ? { label: 'Cadencia', value: `${formatNumber(activity.avg_cadence)} rpm` } : null,
    activity.avg_power ? { label: 'Potencia', value: formatNumber(activity.avg_power, 'W') } : null,
    activity.gain_m ? { label: 'Desnivel', value: formatNumber(activity.gain_m, 'm') } : null,
    activity.loss_m ? { label: 'Bajada', value: formatNumber(activity.loss_m, 'm') } : null,
    activity.min_alt !== null && activity.max_alt !== null
      ? { label: 'Altitud', value: `${formatNumber(activity.min_alt)}–${formatNumber(activity.max_alt)} m` }
      : null,
    activity.calories ? { label: 'Calorías', value: formatNumber(activity.calories) } : null,
    activity.tss ? { label: 'Carga', value: formatNumber(activity.tss) } : null,
  ].filter((item): item is { label: string; value: string } => item !== null);

  const weatherEntries = activity.weather
    ? ([
        ['Temperatura', activity.weather.temp_c, '°C'],
        ['Sensación', activity.weather.feels_like_c, '°C'],
        ['Viento', activity.weather.wind_kmh, 'km/h'],
        ['Humedad', activity.weather.humidity, '%'],
      ] as [string, unknown, string][])
        .filter(([, value]) => typeof value === 'number')
    : [];

  return (
    <>
      <PageHeader
        title={activity.name ?? typeLabel(activity.type)}
        description={`${typeLabel(activity.type)} · ${formatDateTime(activity.start_time)}`}
        actions={
          <Link
            to="/actividades"
            className="focus-ring inline-flex min-h-11 items-center rounded-md border border-line-strong bg-raised px-3 text-body font-semibold text-ink"
          >
            Actividades
          </Link>
        }
      />

      <section aria-label="Resumen" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((item) => (
          <StatCard key={item.label} label={item.label} value={item.value} />
        ))}
      </section>

      {activity.hr_zones && activity.hr_zones.length > 0 ? (
        <Card className="mt-3">
          <SectionTitle>Zonas de FC</SectionTitle>
          <HrZonesChart zones={activity.hr_zones} />
        </Card>
      ) : null}

      {activity.laps.length > 0 ? (
        <Card className="mt-3">
          <SectionTitle hint={`${activity.laps.length} vueltas`}>Vueltas</SectionTitle>
          <LapsList laps={activity.laps} />
        </Card>
      ) : null}

      {weatherEntries.length > 0 ? (
        <Card className="mt-3">
          <SectionTitle>Meteo</SectionTitle>
          <dl className="grid grid-cols-2 gap-2">
            {weatherEntries.map(([label, value, unit]) => (
              <div key={label}>
                <dt className="text-caption text-ink-faint">{label}</dt>
                <dd className="tnum text-body text-ink">
                  {formatNumber(value as number)} {unit}
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}

      {hasTrack ? (
        <section className="mt-3 grid gap-3 lg:grid-cols-2" aria-label="Recorrido y series">
          <Card className="lg:col-span-2">
            <SectionTitle hint={formatNumber(activity.distance_m ? activity.distance_m / 1000 : null, 'km')}>
              Recorrido
            </SectionTitle>
            {track.isPending ? (
              <p className="text-body text-ink-muted">Cargando recorrido…</p>
            ) : track.isError ? (
              <p className="text-caption text-ink-faint">Sin recorrido guardado.</p>
            ) : (
              <RouteSketch track={track.data} />
            )}
          </Card>

          <Card>
            <SectionTitle>Frecuencia cardiaca</SectionTitle>
            {streams.isPending ? (
              <p className="text-body text-ink-muted">Cargando…</p>
            ) : streams.isError ? (
              <p className="text-caption text-ink-faint">Sin series de FC.</p>
            ) : (
              <ActivityStreamChart label="FC" unit="lpm" values={streams.data.hr} />
            )}
          </Card>

          {showsPace ? (
            <Card>
              <SectionTitle>Ritmo</SectionTitle>
              {streams.isPending ? (
                <p className="text-body text-ink-muted">Cargando…</p>
              ) : streams.isError ? (
                <p className="text-caption text-ink-faint">Sin series de ritmo.</p>
              ) : (
                <ActivityStreamChart
                  label="Ritmo"
                  unit="min/km"
                  values={streams.data.pace_sec_km}
                  color="var(--ga-info)"
                  formatValue={(value) =>
                    value > 1800
                      ? '—'
                      : `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}`
                  }
                />
              )}
            </Card>
          ) : null}

          {hasElevation ? (
            <Card>
              <SectionTitle>Altitud</SectionTitle>
              {streams.isPending ? (
                <p className="text-body text-ink-muted">Cargando…</p>
              ) : streams.isError ? (
                <p className="text-caption text-ink-faint">Sin series de altitud.</p>
              ) : (
                <ActivityStreamChart label="Altitud" unit="m" values={streams.data.ele} color="var(--ga-warn)" />
              )}
            </Card>
          ) : null}

          {showsSpeed && hasSpeed ? (
            <Card>
              <SectionTitle>Velocidad</SectionTitle>
              {streams.isPending ? (
                <p className="text-body text-ink-muted">Cargando…</p>
              ) : streams.isError ? (
                <p className="text-caption text-ink-faint">Sin series de velocidad.</p>
              ) : (
                <ActivityStreamChart
                  label="Velocidad"
                  unit="km/h"
                  values={streams.data.speed_ms.map((value) => (value === null ? null : value * 3.6))}
                />
              )}
            </Card>
          ) : null}

          <Card className="lg:col-span-2">
            <SectionTitle hint="cada kilómetro">Parciales</SectionTitle>
            {!showsPace && !showsSpeed ? (
              <p className="text-caption text-ink-faint">Sin parciales para este deporte.</p>
            ) : splits.isPending ? (
              <p className="text-body text-ink-muted">Cargando parciales…</p>
            ) : splits.isError ? (
              <p className="text-caption text-ink-faint">Sin parciales.</p>
            ) : (
              <SplitsList splits={splits.data.splits} />
            )}
          </Card>
        </section>
      ) : (
        <Card className="mt-3">
          <SectionTitle>Series</SectionTitle>
          <EmptyState
            title="Sin recorrido"
            description="Esta actividad no tiene GPS ni series que dibujar."
          />
        </Card>
      )}
    </>
  );
}
