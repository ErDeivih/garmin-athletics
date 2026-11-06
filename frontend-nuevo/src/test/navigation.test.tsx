import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'carga.token';

const apiConSesión = () =>
  installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/metrics/daily': json(f.daily),
    'GET /api/v1/metrics/load': json(f.load),
    'GET /api/v1/alerts': json(f.alerts),
    'GET /api/v1/sync/status': json(f.syncStatus),
    'GET /api/v1/strength/templates': json(f.templates),
    'GET /api/v1/strength/sessions': json(f.sessions),
    'GET /api/v1/strength/exercises': json(f.exercises),
  });

describe('moverse por la app', () => {
  it('va de Hoy a Gimnasio y a Ajustes desde la navegación', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiConSesión();
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Gimnasio' }));
    expect(await screen.findByRole('heading', { name: 'Gimnasio' })).toBeInTheDocument();
    expect(await screen.findByText('Empuje A')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: 'Ajustes' }));
    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    expect(await screen.findByText(/vinculado/i)).toBeInTheDocument();
  });

  it('al cerrar sesión vuelve a la entrada y borra el token', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
      'POST /api/v1/auth/logout': json({ status: 'logged_out' }),
    });
    const user = userEvent.setup();
    renderApp('/ajustes');

    await user.click(await screen.findByRole('button', { name: /cerrar sesión/i }));

    expect(await screen.findByRole('heading', { name: /entra en Carga/i })).toBeInTheDocument();
    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(api.calls.some((call) => call.path === '/api/v1/auth/logout')).toBe(true);
  });
});
