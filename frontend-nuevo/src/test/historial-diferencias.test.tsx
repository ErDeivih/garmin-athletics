import { screen } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const detalle = {
  id: 's-dif',
  name: 'Empuje A',
  template_id: 't-1',
  date: '2026-11-10',
  started_at: '2026-11-10T18:00:00',
  finished_at: '2026-11-10T18:20:00',
  duration_min: 20,
  total_tonnage_kg: 1330,
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
      tonnage_kg: 1330,
      sets: [
        { id: 'a', exercise_id: 'e-1', set_number: 1, weight_kg: 62.5, reps: 8, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 60, planned_reps: 8 },
        { id: 'b', exercise_id: 'e-1', set_number: 2, weight_kg: 62.5, reps: 8, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 62.5, planned_reps: 8 },
        { id: 'c', exercise_id: 'e-1', set_number: 3, weight_kg: 70, reps: 5, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 70, planned_reps: 6 },
      ],
    },
  ],
};

describe('planificado frente a real con diferencias marcadas', () => {
  it('marca las series por encima, iguales y con menos reps que el plan', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/sessions/s-dif': json(detalle),
      'PUT /api/v1/strength/sessions/s-dif': json(detalle),
    });
    renderApp('/gimnasio/sesiones/s-dif');

    await screen.findByRole('heading', { name: /editar pesos reales/i });
    // Serie 1: 62,5 real frente a 60 planificado → +2,5 kg marcado.
    expect(await screen.findByText('+2,5 kg')).toBeInTheDocument();
    // Serie 2: 62,5 frente a 62,5 → igual que el plan.
    expect(screen.getByText('igual que el plan')).toBeInTheDocument();
    // Serie 3: mismo peso pero una repetición menos que el plan.
    expect(screen.getByText('-1 reps')).toBeInTheDocument();
  });
});
