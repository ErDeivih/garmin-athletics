import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'garmin-athletics.token';

const apiBásica = () =>
  installFakeApi({
    'POST /api/v1/auth/login': json(f.token),
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/metrics/daily': json(f.daily),
    'GET /api/v1/alerts': json(f.alerts),
    'GET /api/v1/sync/status': json(f.syncStatus),
  });

describe('entrar en la app', () => {
  it('con email y contraseña guarda el token y abre el panel de hoy con la sesión', async () => {
    const api = apiBásica();
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: /entra en garmin athletics/i })).toBeInTheDocument();

    await user.type(screen.getByLabelText(/correo/i), 'atleta@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'secreto123');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(screen.getByText(/verde/i)).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('test-token');

    const daily = api.calls.find((call) => call.path === '/api/v1/metrics/daily');
    expect(daily?.headers.authorization ?? daily?.headers.Authorization).toBe('Bearer test-token');
  });

  it('si el backend rechaza las credenciales explica el error y no guarda sesión', async () => {
    installFakeApi({
      'POST /api/v1/auth/login': json({ detail: 'Credenciales inválidas.' }, 401),
    });
    const user = userEvent.setup();
    renderApp('/');

    await user.type(await screen.findByLabelText(/correo/i), 'atleta@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'mala');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/credenciales inválidas/i);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('una ruta privada sin sesión lleva al formulario de entrada', async () => {
    installFakeApi({});
    renderApp('/gimnasio');

    expect(await screen.findByRole('heading', { name: /entra en garmin athletics/i })).toBeInTheDocument();
  });

  it('si el token ha caducado, la sesión se limpia y vuelve a la entrada', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-caducado');
    installFakeApi({
      'GET /api/v1/auth/me': json({ detail: 'Sesión caducada.' }, 401),
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: /entra en garmin athletics/i })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('un 401 a mitad de sesión vuelve a la entrada y lo explica', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-caducado');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json({ detail: 'Sesión caducada.' }, 401),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: /entra en garmin athletics/i })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/sesión ha caducado/i);
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
  });

  it('al entrar con otra cuenta no se pinta ni un dato de la anterior', async () => {
    localStorage.setItem(TOKEN_KEY, 'token-de-a');
    let current: 'a' | 'b' = 'a';
    installFakeApi({
      'GET /api/v1/auth/me': () =>
        json(
          current === 'a'
            ? f.me
            : { id: 'u-2', email: 'b@example.com', username: 'b', display_name: 'B', created_at: null },
        ),
      'GET /api/v1/metrics/daily': () =>
        json({ ...f.daily, readiness: { ...f.daily.readiness, score: current === 'a' ? 74 : 11 } }),
      'GET /api/v1/alerts': json({ date: '2026-11-04', count: 0, alerts: [] }),
      'GET /api/v1/sync/status': json(f.syncStatus),
      'POST /api/v1/auth/logout': json({ status: 'logged_out' }),
      'POST /api/v1/auth/login': () => {
        current = 'b';
        return json({ ...f.token, access_token: 'token-de-b' });
      },
    });
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByText('74')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ajustes' }));
    await user.click(await screen.findByRole('button', { name: /cerrar sesión/i }));
    await screen.findByRole('heading', { name: /entra en garmin athletics/i });

    await user.type(screen.getByLabelText(/correo/i), 'b@example.com');
    await user.type(screen.getByLabelText(/contraseña/i), 'secreto123');
    await user.click(screen.getByRole('button', { name: /^entrar$/i }));

    expect(await screen.findByText('11')).toBeInTheDocument();
    expect(screen.queryByText('74')).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBe('token-de-b');
  });
});
