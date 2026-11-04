import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link2, LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, apiFetch } from '../api/client';
import { queryKeys, useSyncNow, useSyncStatus } from '../api/queries';
import type { GarminLinkResult } from '../api/types';
import { EXTENDED_SECTIONS_KEY, setExtendedSections, useExtendedSections } from '../config/features';
import { Badge, Button, Card, ErrorState, Field, PageHeader, SectionTitle } from '../components/ui';
import { formatRelative, formatDate } from '../lib/format';
import { applyTheme, readTheme, type Theme } from '../lib/theme';

function GarminLinkForm() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [ticket, setTicket] = useState<Record<string, unknown> | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.sync }),
      queryClient.invalidateQueries({ queryKey: queryKeys.garmin }),
    ]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiFetch<GarminLinkResult>('/api/v1/auth/garmin-credentials', {
        method: 'PUT',
        body: { garmin_email: email.trim().toLowerCase(), garmin_password: password },
      });
      if (result.status === 'need_mfa') {
        setTicket(result.ticket ?? {});
        return;
      }
      setPassword('');
      setSaved(true);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : 'No se pudo vincular la cuenta.');
    } finally {
      setBusy(false);
    }
  };

  const onMfa = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiFetch<GarminLinkResult>('/api/v1/auth/garmin-mfa', {
        method: 'POST',
        body: {
          garmin_email: email.trim().toLowerCase(),
          garmin_password: password,
          ticket: ticket ?? {},
          code: code.trim(),
        },
      });
      setPassword('');
      setCode('');
      setTicket(null);
      setSaved(true);
      await refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.detail : 'El código no ha funcionado.');
    } finally {
      setBusy(false);
    }
  };

  if (saved) {
    return <p className="text-body text-success">Cuenta de Garmin guardada. La contraseña no se ha almacenado.</p>;
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="mb-2 text-heading text-ink">Vincular Garmin Connect</h3>
      <p className="mb-4 text-caption text-ink-muted">
        La contraseña se usa una sola vez para obtener los tokens y se descarta. Ni la app ni el servidor la guardan.
      </p>
      {ticket ? (
        <form onSubmit={onMfa} className="flex flex-col gap-3">
          <Field
            id="mfa-code"
            label="Código de verificación"
            hint="El código de dos pasos que te acaba de enviar Garmin."
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
          />
          {error ? (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || code.trim().length < 4}>
            {busy ? 'Comprobando…' : 'Completar vinculación'}
          </Button>
        </form>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <Field
            id="garmin-email"
            label="Correo de Garmin"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Field
            id="garmin-password"
            label="Contraseña de Garmin"
            type="password"
            autoComplete="current-password"
            hint="Viaja una vez y no se guarda."
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p role="alert" className="text-body text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy || email.length === 0 || password.length === 0}>
            {busy ? 'Vinculando…' : 'Vincular cuenta'}
          </Button>
        </form>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { user, logout } = useAuth();
  const sync = useSyncStatus();
  const syncNow = useSyncNow();
  const extended = useExtendedSections();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [showLink, setShowLink] = useState(false);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <>
      <PageHeader title="Ajustes" description="Cuenta, conexión con Garmin y preferencias." />

      <Card>
        <SectionTitle hint="Garmin Connect">Conexión</SectionTitle>
        {sync.isPending ? (
          <p className="text-body text-ink-muted">Comprobando la conexión…</p>
        ) : sync.isError ? (
          <ErrorState message={sync.error.message} onRetry={() => void sync.refetch()} />
        ) : sync.data.linked ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="go">Vinculado</Badge>
              <span className="text-body text-ink">{sync.data.garmin_email ?? 'Cuenta de Garmin'}</span>
            </div>
            <p className="text-caption text-ink-faint">
              Última sincronización {formatRelative(sync.data.last_sync_at)} · {sync.data.activities_7d} actividades y{' '}
              {sync.data.tss_7d} TSS en 7 días.
            </p>
            {sync.data.needs_reauth ? (
              <p className="text-body text-warn">Garmin pide volver a iniciar sesión. Vuelve a vincular la cuenta.</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="primary"
                onClick={() => syncNow.mutate()}
                disabled={syncNow.isPending}
              >
                {syncNow.isPending ? 'Sincronizando…' : 'Sincronizar ahora'}
              </Button>
              <Button variant="ghost" onClick={() => setShowLink((value) => !value)}>
                <Link2 aria-hidden="true" className="size-4" />
                Cambiar cuenta
              </Button>
            </div>
            {syncNow.isSuccess ? (
              <p role="status" className="rounded-md border border-success bg-success-soft px-3 py-2 text-body text-success">
                {syncNow.data.message}
              </p>
            ) : null}
            {syncNow.isError ? (
              <p role="alert" className="text-body text-danger">
                {syncNow.error.message}
              </p>
            ) : null}
            {showLink ? <GarminLinkForm /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink-muted">
              Sin Garmin Connect no hay biometría ni actividades: el panel «Hoy» estará vacío a propósito.
            </p>
            <Button variant="primary" onClick={() => setShowLink((value) => !value)}>
              <Link2 aria-hidden="true" className="size-4" />
              Vincular Garmin
            </Button>
            {showLink ? <GarminLinkForm /> : null}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <SectionTitle>Apariencia</SectionTitle>
        <div className="flex flex-wrap gap-2">
          <Button variant={theme === 'dark' ? 'primary' : 'secondary'} aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>
            <Moon aria-hidden="true" className="size-4" />
            Oscuro
          </Button>
          <Button variant={theme === 'light' ? 'primary' : 'secondary'} aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>
            <Sun aria-hidden="true" className="size-4" />
            Claro
          </Button>
        </div>
      </Card>

      <Card className="mt-6">
        <SectionTitle>Secciones</SectionTitle>
        <div className="flex items-start gap-3">
          <input
            id="extended-sections"
            type="checkbox"
            className="focus-ring mt-1 size-5 rounded-sm border border-line-strong accent-[var(--ga-accent)]"
            checked={extended}
            onChange={(event) => setExtendedSections(event.target.checked)}
            aria-describedby="extended-sections-hint"
          />
          <label htmlFor="extended-sections" className="text-body text-ink">
            Secciones ampliadas
            <span id="extended-sections-hint" className="mt-1 block text-caption text-ink-muted">
              Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social. Están construidas contra la misma API;
              la bandera solo decide si se ven.
            </span>
          </label>
        </div>
        <p className="mt-3 text-caption text-ink-faint">
          Atajo de desarrollo: {EXTENDED_SECTIONS_KEY} en el almacenamiento del navegador.
        </p>
      </Card>

      <Card className="mt-6">
        <SectionTitle>Cuenta</SectionTitle>
        <dl className="mb-4 grid gap-2 sm:grid-cols-2">
          <div>
            <dt className="text-caption uppercase tracking-wider text-ink-muted">Nombre</dt>
            <dd className="text-body text-ink">{user?.display_name ?? 'sin nombre'}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-wider text-ink-muted">Correo</dt>
            <dd className="text-body text-ink">{user?.email ?? 'sin correo'}</dd>
          </div>
          <div>
            <dt className="text-caption uppercase tracking-wider text-ink-muted">Alta</dt>
            <dd className="text-body text-ink">{formatDate(user?.created_at)}</dd>
          </div>
        </dl>
        <Button variant="secondary" onClick={() => void logout()}>
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </Button>
      </Card>
    </>
  );
}
