import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'carga.token';
const exercise = f.templates.items[0]!.exercises[0]!.exercise;

describe('editor de detección automática por ejercicio', () => {
  it('activa la detección sin pedir duración ni inicio de serie', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    let active = false;
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/exercises/e-1': json({ exercise, last: null, pr: null, sessions_count: 0 }),
      'GET /api/v1/strength/exercises/e-1/motion-profile': () =>
        json(active
          ? { configured: true, version: 1, status: 'active', profile: { schema_version: 1, auto: true } }
          : { configured: false, profile: null, status: null }),
      'PUT /api/v1/strength/exercises/e-1/motion-profile': (req) => {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        active = body.status === 'active';
        return json({ status: 'saved', id: 'mp-1', version: 1, profile_status: body.status });
      },
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/ejercicios/e-1/deteccion');

    expect(await screen.findByRole('heading', { name: /detección de repeticiones/i })).toBeInTheDocument();
    expect(screen.getByText(/detecta el movimiento/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/duración de una repetición/i)).toBeNull();
    expect(screen.queryByLabelText(/repeticiones para empezar/i)).toBeNull();

    await user.click(screen.getByRole('button', { name: /activar detección automática/i }));

    expect(await screen.findByText(/detección activada/i)).toBeInTheDocument();
    const call = api.calls.find(
      (item) => item.method === 'PUT' && item.path === '/api/v1/strength/exercises/e-1/motion-profile',
    );
    const body = typeof call?.body === 'string' ? JSON.parse(call.body) : call?.body;
    expect(body.status).toBe('active');
    expect(body.profile.auto).toBe(true);
    expect(body.profile.rep.expected_duration_s).toBeUndefined();
  });
});
