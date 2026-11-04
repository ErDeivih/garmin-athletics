import { Link } from 'react-router-dom';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAlerts, useDailyMetrics, useSyncNow, useSyncStatus } from '../api/queries';
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
import { formatLongDate, formatNumber, formatRelative } from '../lib/format';

const statusTone: Record<ReadinessStatus, 'go' | 'warn' | 'stop'> = {
  VERDE: 'go',
  AMARILLO: 'warn',
  ROJO: 'stop',
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

function SyncBanner() {
  const sync = useSyncStatus();

  if (sync.isPending) return null;
  if (sync.isError) {
    return (
      <p role="alert" className="mb-4 rounded-md border border-warn bg-warn-soft px-3 py-2 text-body text-warn">
        No se pudo leer el estado de Garmin. Revisa la conexión en Ajustes.
      </p>
    );
  }

  const status = sync.data;
  if (status.needs_reauth) {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warn bg-warn-soft px-3 py-2">
        <span className="flex items-center gap-2 text-body text-warn">
          <AlertTriangle aria-hidden="true" className="size-4" />
          Garmin necesita que vuelvas a iniciar sesión.
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
          Garmin Connect no está vinculado: el panel solo tiene datos antiguos.
        </span>
        <Link className="focus-ring rounded-md px-2 py-1 text-body font-semibold text-accent underline" to="/ajustes">
          Vincular Garmin
        </Link>
      </div>
    );
  }
  return (
    <p className="mb-4 flex items-center gap-2 text-caption text-ink-faint">
      <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
      Garmin · última sincronización {formatRelative(status.last_sync_at)}
    </p>
  );
}

export function TodayPage() {
  const daily = useDailyMetrics();
  const alerts = useAlerts();
  const sync = useSyncStatus();
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
        <ErrorState message={daily.error.message} onRetry={() => void daily.refetch()} />
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
              ? 'La cuenta de Garmin está vinculada, pero la sincronización todavía no ha traído la biometría de hoy. Lánzala a mano o espera a la próxima.'
              : 'Para ver tu disposición hacen falta los datos de tu cuenta de Garmin. Vincúlala en Ajustes y sincroniza.'
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
                Vincular Garmin
              </Link>
            )
          }
        />
        {syncNow.isError ? (
          <p role="alert" className="mt-4 text-body text-danger">
            {syncNow.error.message}
          </p>
        ) : null}
      </>
    );
  }

  const readiness = metrics.readiness;
  const components = readiness.components;

  return (
    <>
      {header}
      <SyncBanner />

      <section aria-label="Disposición" className="grid gap-4 lg:grid-cols-3">
        <StatCard
          hero
          label="Disposición"
          value={readiness.score}
          unit="/ 100"
          delta={`${readiness.message}`}
          foot={`Sueño ${formatNumber(components.sleep_contribution)} · HRV ${formatNumber(components.hrv_contribution)} · TSB ${formatNumber(components.tsb_contribution)}`}
        />
        <div className="lg:col-span-2">
          <Card>
            <SectionTitle hint="Peso de cada componente">Cómo se compone</SectionTitle>
            <span className="mb-3 inline-flex">
              <Badge tone={statusTone[readiness.status]}>{readiness.status}</Badge>
            </span>
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-caption uppercase tracking-wider text-ink-muted">Sueño</dt>
                <dd className="tnum font-display text-title text-ink">
                  {formatNumber(components.sleep_contribution)}
                </dd>
                <span className="text-caption text-ink-faint">de 35 puntos</span>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-wider text-ink-muted">HRV</dt>
                <dd className="tnum font-display text-title text-ink">
                  {formatNumber(components.hrv_contribution)}
                </dd>
                <span className="text-caption text-ink-faint">de 40 puntos</span>
              </div>
              <div>
                <dt className="text-caption uppercase tracking-wider text-ink-muted">TSB</dt>
                <dd className="tnum font-display text-title text-ink">
                  {formatNumber(components.tsb_contribution)}
                </dd>
                <span className="text-caption text-ink-faint">de 25 puntos</span>
              </div>
            </dl>
          </Card>
        </div>
      </section>

      <section aria-label="Métricas de hoy" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Sueño"
          value={metrics.sleep.hours ?? '—'}
          unit={metrics.sleep.hours === null ? 'sin dato' : 'h'}
          delta={metrics.sleep.score === null ? 'sin puntuación' : `Puntuación ${metrics.sleep.score}`}
          foot={`Media 7 d: ${formatNumber(metrics.sleep.avg_7d, 'h')} · eficiencia ${formatNumber(metrics.sleep.efficiency, '%')}`}
        />
        <StatCard
          label="HRV"
          value={metrics.hrv.overnight ?? '—'}
          unit={metrics.hrv.overnight === null ? 'sin dato' : 'ms'}
          delta={metrics.hrv.status === 'normal' ? 'En tu media' : `Estado ${metrics.hrv.status}`}
          foot={`Media 7 d: ${formatNumber(metrics.hrv.avg_7d, 'ms')}`}
        />
        <StatCard
          label="Body Battery"
          value={metrics.body_battery.wake ?? metrics.body_battery.max ?? '—'}
          unit="/ 100"
          foot={`Máx ${formatNumber(metrics.body_battery.max)} · mín ${formatNumber(metrics.body_battery.min)}`}
        />
        <StatCard
          label="FC en reposo"
          value={metrics.resting_hr ?? '—'}
          unit={metrics.resting_hr === null ? 'sin dato' : 'lpm'}
          foot={`Media 7 d: ${formatNumber(metrics.resting_hr_7d, 'lpm')}`}
        />
        <StatCard
          label="Estrés"
          value={metrics.stress_avg ?? '—'}
          unit="/ 100"
          foot="Media del día"
        />
        <StatCard
          label="Carga y frescura"
          value={formatNumber(metrics.tsb)}
          unit="TSB"
          foot={`ATL ${formatNumber(metrics.atl)} · CTL ${formatNumber(metrics.ctl)}`}
        />
      </section>

      <Card className="mt-6">
        <SectionTitle hint={alerts.data ? `${alerts.data.count} avisos` : undefined}>Avisos</SectionTitle>
        {alerts.isPending ? (
          <p className="text-body text-ink-muted">Cargando avisos…</p>
        ) : alerts.isError ? (
          <p role="alert" className="text-body text-danger">
            {alerts.error.message}
          </p>
        ) : alerts.data.alerts.length === 0 ? (
          <p className="text-body text-ink-muted">Ningún aviso para hoy.</p>
        ) : (
          <ul className="flex flex-col gap-3">
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
