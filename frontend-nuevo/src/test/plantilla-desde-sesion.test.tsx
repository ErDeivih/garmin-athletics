import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const sesion = {
  id: 's-2',
  name: 'Empuje A',
  template_id: 't-1',
  date: '2026-11-10',
  started_at: '2026-11-10T18:00:00',
  finished_at: '2026-11-10T18:18:00',
  duration_min: 18,
  total_tonnage_kg: 1420,
  computed_tss: 0,
  sets_count: 3,
  exercises_count: 1,
  notes: null,
  status: 'saved',
  activity_id: null,
  exercises: [
    {
      exercise: { id: 'e-1', name: 'Press de banca', slug: 'press-de-banca', muscle_group: 'pecho', equipment: 'barra', is_timed: false, is_unilateral: false },
      position: 0,
      tonnage_kg: 1420,
      sets: [
        { id: 'set-1', exercise_id: 'e-1', set_number: 1, weight_kg: 60, reps: 8, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 60, planned_reps: 8 },
        { id: 'set-2', exercise_id: 'e-1', set_number: 2, weight_kg: 65, reps: 8, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 65, planned_reps: 8 },
        { id: 'set-3', exercise_id: 'e-1', set_number: 3, weight_kg: 70, reps: 6, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 70, planned_reps: 6 },
      ],
    },
  ],
};

describe('guardar una sesión como plantilla', () => {
  it('crea la plantilla con los pesos reales de la sesión', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/sessions/s-2': json(sesion),
      'PUT /api/v1/strength/sessions/s-2': json(sesion),
      'POST /api/v1/strength/templates': json({ ...f.templates.items[0], id: 't-nueva', name: 'Plantilla de Empuje A' }, 201),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/sesiones/s-2');

    await screen.findByRole('heading', { name: /editar pesos reales/i });
    await user.click(screen.getByRole('button', { name: /guardar como plantilla/i }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'POST' && call.path === '/api/v1/strength/templates')).toBe(true);
    });
    const llamada = api.calls.find((call) => call.method === 'POST' && call.path === '/api/v1/strength/templates');
    const cuerpo = typeof llamada?.body === 'string' ? JSON.parse(llamada.body) : llamada?.body;
    expect(cuerpo.exercises[0].exercise_id).toBe('e-1');
    expect(cuerpo.exercises[0].set_targets.map((t: { weight_kg: number }) => t.weight_kg)).toEqual([60, 65, 70]);
    expect(await screen.findByText(/plantilla creada/i)).toBeInTheDocument();
  });
});
