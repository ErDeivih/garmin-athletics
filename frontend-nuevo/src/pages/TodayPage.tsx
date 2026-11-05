import { Link } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { useAlerts, useDailyMetrics, useLoad, useSyncNow, useSyncStatus } from '../api/queries';
import type { AlertSeverity, ReadinessStatus } from '../api/types';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  LoadingBlock,
  PageHeader,
  SectionTitle,
  StatCard,
} from '../components/ui';
import { BodyBatteryChart, LoadChart } from '../components/charts';
import { formatLongDate, formatNumber } from '../lib/format';

const statusTone: Record<ReadinessStatus, 'go' | 'warn' | 'stop'> = {
  VERDE: 'go',
  AMARILLO: 'warn',
  ROJO: 'stop',
};

const statusLabel: Record<ReadinessStatus, string> = {
  VERDE: 'Listo',
  AMARILLO: 'Con cuidado',
  ROJO: 'Descansa',
};

const alertTone: Record<AlertSeverity, 'stop' | 'warn' | 'info'> = {
  high: 'stop',
  warn: 'warn',
  info: 'info',
};

const alertLabel: Record<AlertSeverity, string> = {
  high: 'Importante',
  warn: 'Aviso',
  info: 'Info',
};

// El backend puede devolver el estado de HRV como `normal` (calculado) o con el
// texto que manda Garmin (`BALANCED`); la interfaz habla siempre en español.
const HRV_STATUS_LABEL: Record<string, string> = {
  normal: 'En tu media',
  balanced: 'En tu media',
  low: 'Por debajo de tu media',
  high: 'Por encima de tu media',
  unknown: 'Sin dato',
};

function SyncBanner() {
  const sync = useSyncStatus();

  if (sync.isPending) return null;
  if (sync.isError) {
    return (
      <p role="alert" className="mb-4 rounded-md border border-warn bg-warn-soft px-3 py-2 text-body text-warn">
        No se pudo comprobar la conexión.
      </p>
    );
  }

  const status = sync.data;
  if (status.needs_reauth) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn bg-warn-soft px-3 py-2">
        <span className="flex items-center gap-2 text-body text-warn">
          <AlertTriangle aria-hidden="true" className="size-4" />
          Vuelve a vincular tu cuenta.
        </span>
        <Link className="focus-ring rounded-md px-2 py-1 text-body font-semibold text-warn underline" to="/ajustes">
          Revisar conexión
        </Link>
      </div>
    );
  }
  if (!status.linked) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-line bg-raised px-3 py-2">
        <span className="flex items-center gap-2 text-body text-ink-muted">
          <AlertTriangle aria-hidden="true" className="size-4 text-warn" />
          Conecta tu cuenta para ver tus datos.
        </span>
        <Link className="focus-ring rounded-md px-2 py-1 text-body font-semibold text-accent underline" to="/ajustes">
          Vincular
        </Link>
      </div>
    );
  }
  return null;
}

export function TodayPage() {
  const daily = useDailyMetrics();
  const alerts = useAlerts();
  const sync = useSyncStatus();
  const load = useLoad(30);
  const syncNow = useSyncNow();

  const header = (
    <PageHeader
      title="Hoy"
      description={daily.data ? `Tu disposición · ${formatLongDate(daily.data.date)}` : 'Tu disposición de hoy'}
    />
  );

  if (daily.isPending || sync.isPending) {
    return (
      <>
        {header}
        <LoadingBlock label="Cargando el panel de hoy" />
      </>
    );
  }

  if (daily.isError) {
    return (
      <>
        {header}
        <ErrorState message="No se pudieron cargar tus datos de hoy." onRetry={() => void daily.refetch()} />
      </>
    );
  }

  const metrics = daily.data;

  if (!metrics.biometrics_available) {
    const linked = sync.data?.linked ?? false;
    return (
      <>
        {header}
        <EmptyState
          title="Sin datos de hoy"
          description={
            linked
              ? 'Todavía no hay datos de hoy. Sincroniza para verlos.'
              : 'Conecta tu cuenta para ver tu disposición.'
          }
          action={
            linked ? (
              <Button variant="primary" onClick={() => syncNow.mutate()} disabled={syncNow.isPending}>
                {syncNow.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
            ) : (
              <Link
                to="/ajustes"
                className="focus-ring inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-4 text-body font-semibold text-on-accent"
              >
                Vincular cuenta
              </Link>
            )
          }
        />
        {syncNow.isError ? (
          <p role="alert" className="mt-4 text-body text-danger">
            No se pudo sincronizar. Inténtalo otra vez.
          </p>
        ) : null}
      </>
    );
  }

  const readiness = metrics.readiness;

  return (
    <>
      {header}
      <SyncBanner />

      <section aria-label="Disposición">
        <Card className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-caption uppercase tracking-wider text-ink-muted">Disposición</span>
            <p className="mt-0.5 text-caption text-ink-faint">Tu estado para entrenar hoy.</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="tnum font-display text-hero font-bold text-ink">{readiness.score}</span>
              <span className="text-caption text-ink-muted">/ 100</span>
            </div>
            <p className="mt-1 text-body text-ink">{readiness.message}</p>
          </div>
          <Badge tone={statusTone[readiness.status]}>{statusLabel[readiness.status]}</Badge>
        </Card>
      </section>

      <section aria-label="Métricas de hoy" className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Sueño"
          hint="Cuánto y cómo has dormido."
          value={metrics.sleep.hours ?? '—'}
          unit={metrics.sleep.hours === null ? 'sin dato' : 'h'}
          delta={metrics.sleep.score === null ? undefined : `Puntuación ${metrics.sleep.score}`}
          foot={`Media 7 d: ${formatNumber(metrics.sleep.avg_7d, 'h')}`}
        />
        <StatCard
          label="HRV"
          hint="Variación entre latidos."
          value={metrics.hrv.overnight ?? '—'}
          unit={metrics.hrv.overnight === null ? 'sin dato' : 'ms'}
          delta={HRV_STATUS_LABEL[metrics.hrv.status.toLowerCase()] ?? 'Sin dato'}
          foot={`Media 7 d: ${formatNumber(metrics.hrv.avg_7d, 'ms')}`}
        />
        <StatCard
          label="FC en reposo"
          hint="Tu pulso en calma."
          value={metrics.resting_hr ?? '—'}
          unit={metrics.resting_hr === null ? 'sin dato' : 'lpm'}
          foot={`Media 7 d: ${formatNumber(metrics.resting_hr_7d, 'lpm')}`}
        />
        <StatCard
          label="Estrés"
          hint="Cuánto ha subido tu pulso sin esfuerzo."
          value={metrics.stress_avg ?? '—'}
          unit="/ 100"
          foot="Media del día"
        />
        <StatCard
          label="Frescura"
          hint="Positivo: descansado. Negativo: cargado."
          value={formatNumber(metrics.tsb)}
          foot={`Carga aguda ${formatNumber(metrics.atl)} · Forma ${formatNumber(metrics.ctl)}`}
          className="col-span-2 sm:col-span-1"
        />
      </section>

      <section aria-label="Carga y energía" className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SectionTitle hint="Últimos 30 días">Carga de entrenamiento</SectionTitle>
          <p className="mb-2 text-caption text-ink-muted">
            Carga aguda: lo que has entrenado esta semana. Forma: lo acumulado en las últimas semanas.
          </p>
          {load.isPending ? (
            <p role="status" className="text-body text-ink-muted">
              Cargando la carga…
            </p>
          ) : load.isError ? (
            <p role="alert" className="text-body text-danger">
              No se pudo cargar la carga.
            </p>
          ) : (
            <LoadChart series={load.data.series} />
          )}
        </Card>
        <Card>
          <SectionTitle hint="Hoy">Body Battery</SectionTitle>
          <p className="mb-2 text-caption text-ink-muted">Energía disponible a lo largo del día.</p>
          <BodyBatteryChart curve={metrics.body_battery.curve ?? []} />
          <p className="mt-2 text-caption text-ink-muted">
            Al despertar {formatNumber(metrics.body_battery.wake)} / 100 · máx{' '}
            {formatNumber(metrics.body_battery.max)} · mín {formatNumber(metrics.body_battery.min)}
          </p>
        </Card>
      </section>

      <Card className="mt-3">
        <SectionTitle hint={alerts.data ? `${alerts.data.count} avisos` : undefined}>Avisos</SectionTitle>
        {alerts.isPending ? (
          <p className="text-body text-ink-muted">Cargando avisos…</p>
        ) : alerts.isError ? (
          <p role="alert" className="text-body text-danger">
            No se pudieron cargar los avisos.
          </p>
        ) : alerts.data.alerts.length === 0 ? (
          <p className="text-body text-ink-muted">Ningún aviso para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {alerts.data.alerts.map((alert) => (
              <li key={`${alert.type}-${alert.message}`} className="flex flex-wrap items-start gap-2">
                <Badge tone={alertTone[alert.severity]}>{alertLabel[alert.severity]}</Badge>
                <span className="text-body text-ink">{alert.message}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
