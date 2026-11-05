import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link2, LogOut, Moon, Sun, Trash2 } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { ApiError, apiFetch } from '../api/client';
import { queryKeys } from '../api/queries';
import { useDeleteAccount, useSyncNow, useSyncStatus } from '../api/queries';
import type { WatchLinkResult } from '../api/types';
import { setExtendedSections, useExtendedSections } from '../config/features';
import { Badge, Button, Card, ErrorState, Field, PageHeader, SectionTitle } from '../components/ui';
import { applyTheme, readTheme, type Theme } from '../lib/theme';

function LinkAccountForm() {
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
      queryClient.invalidateQueries({ queryKey: queryKeys.watchAccount }),
    ]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const result = await apiFetch<WatchLinkResult>('/api/v1/auth/garmin-credentials', {
        method: 'PUT',
        body: { garmin_email: email.trim().toLowerCase(), garmin_password: password },
        // Un 401 aquí es una contraseña incorrecta de la cuenta externa, no una
        // sesión caducada: la app no debe expulsar al atleta de su sesión.
        session: 'external',
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
      await apiFetch<WatchLinkResult>('/api/v1/auth/garmin-mfa', {
        method: 'POST',
        body: {
          garmin_email: email.trim().toLowerCase(),
          garmin_password: password,
          ticket: ticket ?? {},
          code: code.trim(),
        },
        session: 'external',
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
    return <p className="text-body text-success">Cuenta vinculada. No guardamos tu contraseña.</p>;
  }

  return (
    <div className="mt-4 border-t border-line pt-4">
      <h3 className="mb-2 text-heading text-ink">Vincular cuenta</h3>
      <p className="mb-4 text-caption text-ink-muted">
        No guardamos tu contraseña.
      </p>
      {ticket ? (
        <form onSubmit={onMfa} className="flex flex-col gap-3">
          <Field
            id="mfa-code"
            label="Código de verificación"
            hint="El código de dos pasos."
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
            id="watch-email"
            label="Correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Field
            id="watch-password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
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
            {busy ? 'Vinculando…' : 'Conectar'}
          </Button>
        </form>
      )}
    </div>
  );
}

export function SettingsPage() {
  const { user, logout, forgetSession } = useAuth();
  const sync = useSyncStatus();
  const syncNow = useSyncNow();
  const deleteAccount = useDeleteAccount();
  const extended = useExtendedSections();
  const [theme, setTheme] = useState<Theme>(readTheme);
  const [showLink, setShowLink] = useState(false);
  const [deleteRevealed, setDeleteRevealed] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  return (
    <>
      <PageHeader title="Ajustes" description="Cuenta, conexión y preferencias." />

      <Card>
        <SectionTitle hint="Cuenta">Conexión</SectionTitle>
        {sync.isPending ? (
          <p className="text-body text-ink-muted">Comprobando la conexión…</p>
        ) : sync.isError ? (
          <ErrorState message={sync.error.message} onRetry={() => void sync.refetch()} />
        ) : sync.data.linked ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="go">Vinculado</Badge>
              <span className="text-body text-ink">{sync.data.garmin_email ?? 'Cuenta'}</span>
            </div>
            {sync.data.needs_reauth ? (
              <p className="text-body text-warn">Vuelve a vincular tu cuenta para seguir sincronizando.</p>
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
            {showLink ? <LinkAccountForm /> : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-body text-ink-muted">
              Conecta tu cuenta para ver tu actividad y tu recuperación.
            </p>
            <Button variant="primary" onClick={() => setShowLink((value) => !value)}>
              <Link2 aria-hidden="true" className="size-4" />
              Vincular cuenta
            </Button>
            {showLink ? <LinkAccountForm /> : null}
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
            Mostrar todas las secciones
            <span id="extended-sections-hint" className="mt-1 block text-caption text-ink-muted">
              Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social.
            </span>
          </label>
        </div>
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
        </dl>
        <Button variant="secondary" onClick={() => void logout()}>
          <LogOut aria-hidden="true" className="size-4" />
          Cerrar sesión
        </Button>
      </Card>

      <Card className="mt-6 border-danger">
        <SectionTitle>Borrar cuenta</SectionTitle>
        <p className="mb-3 max-w-prose text-body text-ink-muted">
          Se borran tu biometría y tus datos de salud, tus actividades, tus sesiones y series, tus
          plantillas y tus ejercicios propios. Es irreversible: no hay copia que recuperar.
        </p>
        {deleteError ? (
          <p role="alert" className="mb-3 text-body text-danger">
            {deleteError}
          </p>
        ) : null}
        {deleteRevealed ? (
          <div className="flex flex-col gap-3">
            <Field
              id="delete-account-confirm"
              label="Escribe BORRAR MI CUENTA para confirmar"
              autoComplete="off"
              value={deletePhrase}
              onChange={(event) => setDeletePhrase(event.target.value)}
              hint="La frase tiene que coincidir exactamente; es la última barrera."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="danger"
                disabled={deletePhrase.trim() !== 'BORRAR MI CUENTA' || deleteAccount.isPending}
                onClick={() => {
                  setDeleteError(null);
                  deleteAccount.mutate(undefined, {
                    onSuccess: () => forgetSession(),
                    onError: (cause) => setDeleteError(cause.message),
                  });
                }}
              >
                <Trash2 aria-hidden="true" className="size-4" />
                {deleteAccount.isPending ? 'Borrando…' : 'Borrar mi cuenta definitivamente'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setDeleteRevealed(false);
                  setDeletePhrase('');
                  setDeleteError(null);
                }}
              >
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="danger" onClick={() => setDeleteRevealed(true)}>
            <Trash2 aria-hidden="true" className="size-4" />
            Borrar mi cuenta
          </Button>
        )}
      </Card>
    </>
  );
}
