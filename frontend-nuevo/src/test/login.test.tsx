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
});
