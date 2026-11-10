import { screen, within } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const sesionResumen = (id: string, date: string, tonnage: number, sets: number, minutes: number) => ({
  ...(f.sessions.items?.[0] ?? {}),
  id,
  name: 'Empuje A',
  template_id: 't-1',
  date,
  started_at: `${date}T18:00:00`,
  finished_at: `${date}T18:${String(minutes).padStart(2, '0')}:00`,
  duration_min: minutes,
  total_tonnage_kg: tonnage,
  computed_tss: 0,
  sets_count: sets,
  exercises_count: 1,
  notes: null,
});

const listaSesiones = {
  total: 2,
  limit: 50,
  offset: 0,
  items: [
    sesionResumen('s-2', '2026-11-10', 1420, 3, 18),
    sesionResumen('s-1', '2026-11-08', 980, 2, 12),
  ],
};

const detalleSesion = {
  ...sesionResumen('s-2', '2026-11-10', 1420, 3, 18),
  status: 'saved',
  activity_id: null,
  exercises: [
    {
      exercise: f.templates.items[0]!.exercises[0]!.exercise,
      position: 0,
      tonnage_kg: 1420,
      sets: [
        { id: 'set-1', exercise_id: 'e-1', set_number: 1, weight_kg: 60, reps: 8, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 60, planned_reps: 8 },
        { id: 'set-2', exercise_id: 'e-1', set_number: 2, weight_kg: 62.5, reps: 8, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 65, planned_reps: 8 },
        { id: 'set-3', exercise_id: 'e-1', set_number: 3, weight_kg: 70, reps: 6, rir: null, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null, planned_weight_kg: 70, planned_reps: 6 },
      ],
    },
  ],
};

function apiHistorial() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/sessions': json(listaSesiones),
    'GET /api/v1/strength/sessions/s-2': json(detalleSesion),
  });
}

describe('historial de sesiones', () => {
  it('lista fecha, duración, volumen y series, y enlaza al detalle', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiHistorial();
    renderApp('/gimnasio/historial');

    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    const filas = await screen.findAllByRole('link', { name: /empuje a/i });
    expect(filas.length).toBe(2);
    const primera = filas[0]!;
    expect(within(primera).getByText(/1420 kg/)).toBeInTheDocument();
    expect(within(primera).getByText(/3 series/i)).toBeInTheDocument();
    expect(within(primera).getByText(/18 min/i)).toBeInTheDocument();
    expect(within(primera).getByText(/10 nov/i)).toBeInTheDocument();
    expect(primera).toHaveAttribute('href', '/gimnasio/sesiones/s-2');
  });

  it('en el detalle se ve el peso planificado frente al real', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiHistorial();
    renderApp('/gimnasio/sesiones/s-2');

    expect(await screen.findByRole('heading', { name: /editar pesos reales/i })).toBeInTheDocument();
    expect(screen.getByText(/plan 65 kg × 8/i)).toBeInTheDocument();
    expect(screen.getByText(/62,5 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/plan 60 kg × 8/i)).toBeInTheDocument();
  });
});
