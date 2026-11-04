import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import { initTheme } from '../lib/theme';
import * as f from './fixtures';

const TOKEN_KEY = 'garmin-athletics.token';

describe('ajustes y sincronización', () => {
  it('lanza una sincronización y cuenta que ha ido bien', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    let synced = false;
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': () =>
        json(synced ? { ...f.syncStatus, last_sync_at: '2026-11-04T17:30:00' } : f.syncStatus),
      'POST /api/v1/sync/garmin': () => {
        synced = true;
        return json({ status: 'success', message: 'Sincronización completada.' });
      },
    });
    const user = userEvent.setup();
    renderApp('/ajustes');

    await user.click(await screen.findByRole('button', { name: /sincronizar ahora/i }));

    expect(await screen.findByRole('status')).toHaveTextContent(/sincronización completada/i);
    expect(api.calls.filter((call) => call.path === '/api/v1/sync/status').length).toBeGreaterThan(1);
  });

  it('sin Garmin vinculado pide vincular en vez de ofrecer sincronizar', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatusUnlinked),
    });
    renderApp('/ajustes');

    expect(await screen.findByRole('button', { name: /vincular garmin/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /sincronizar ahora/i })).toBeNull();
  });

  it('una contraseña de Garmin incorrecta muestra el error sin cerrar la sesión', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatusUnlinked),
      'PUT /api/v1/auth/garmin-credentials': json({ detail: 'Garmin rechazó las credenciales.' }, 401),
    });
    const user = userEvent.setup();
    renderApp('/ajustes');

    await user.click(await screen.findByRole('button', { name: /vincular garmin/i }));
    await user.type(screen.getByLabelText(/correo de garmin/i), 'atleta@example.com');
    await user.type(screen.getByLabelText(/contraseña de garmin/i), 'mal');
    await user.click(screen.getByRole('button', { name: /vincular cuenta/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/garmin rechazó las credenciales/i);
    // Sigue dentro: el 401 era de Garmin, no de la sesión de la app.
    expect(screen.getByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token');
  });

  it('el tema claro se aplica y sobrevive a recargar la app', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    const user = userEvent.setup();
    const first = renderApp('/ajustes');

    await user.click(await screen.findByRole('button', { name: /claro/i }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('garmin-athletics.theme')).toBe('light');

    // Simula recargar: se desmonta la app, main.tsx vuelve a aplicar el tema y
    // se monta de nuevo con la sesión guardada.
    first.unmount();
    initTheme();
    expect(document.documentElement.dataset.theme).toBe('light');
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});
