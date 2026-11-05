import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'forja.token';
const exercise = f.templates.items[0]!.exercises[0]!.exercise;

describe('editor de detección IMU por ejercicio', () => {
  it('configura la duración de la repetición y activa la detección', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    let active = false;
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/exercises/e-1': json({
        exercise,
        last: null,
        pr: null,
        sessions_count: 0,
      }),
      'GET /api/v1/strength/exercises/e-1/motion-profile': () =>
        json(
          active
            ? {
                configured: true,
                version: 1,
                status: 'active',
                profile: { schema_version: 1, rep: { expected_duration_s: 3 }, set: { start_after_reps: 2 } },
              }
            : { configured: false, profile: null, status: null },
        ),
      'PUT /api/v1/strength/exercises/e-1/motion-profile': (req) => {
        const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        active = body.status === 'active';
        return json({ status: 'saved', id: 'mp-1', version: 1, profile_status: body.status });
      },
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/ejercicios/e-1/deteccion');

    expect(await screen.findByRole('heading', { name: /detección de repeticiones/i })).toBeInTheDocument();
    expect(screen.getByText(/configura el movimiento/i)).toBeInTheDocument();

    const duration = screen.getByLabelText(/duración de una repetición/i);
    await user.clear(duration);
    await user.type(duration, '3');
    await user.click(screen.getByRole('button', { name: /guardar y activar/i }));

    expect(await screen.findByText(/detección activada/i)).toBeInTheDocument();
    const call = api.calls.find(
      (item) => item.method === 'PUT' && item.path === '/api/v1/strength/exercises/e-1/motion-profile',
    );
    const body = typeof call?.body === 'string' ? JSON.parse(call.body) : call?.body;
    expect(body.status).toBe('active');
    expect(body.profile.rep.expected_duration_s).toBe(3);
  });
});
