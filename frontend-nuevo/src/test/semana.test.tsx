import { screen, within } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const estadisticas = {
  from: '2026-11-09',
  to: '2026-11-15',
  days: 7,
  totals: { sessions: 2, sets: 3, working_sets: 3, tonnage_kg: 1420, reps: 22, duration_min: 36 },
  by_muscle: [
    { muscle_group: 'pecho', label: 'Pecho', sets: 3, working_sets: 3, tonnage_kg: 1420, exercises: 1 },
  ],
  by_week: [],
  by_exercise: [],
};

const calendario = {
  from: '2026-11-09',
  to: '2026-11-15',
  days: [
    {
      date: '2026-11-10',
      events: [
        { id: 'ev-1', title: 'Empuje A', event_type: 'strength', start: '2026-11-10T18:00:00', duration_min: 60, weekday: null, template_id: 't-1', is_immovable: false, notes: null },
        { id: 'ev-2', title: 'Pierna B', event_type: 'strength', start: '2026-11-12T18:00:00', duration_min: 60, weekday: null, template_id: 't-2', is_immovable: false, notes: null },
        { id: 'ev-3', title: 'Espalda C', event_type: 'planned_workout', start: '2026-11-13T18:00:00', duration_min: 60, weekday: null, template_id: 't-3', is_immovable: false, notes: null },
      ],
      activities: [],
      readiness: null,
    },
  ],
};

function apiSemana() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/stats': json(estadisticas),
    'GET /api/v1/calendar': json(calendario),
    'GET /api/v1/strength/sessions': json(f.sessions),
  });
}

describe('resumen semanal', () => {
  it('muestra volumen, series por grupo muscular y adherencia al plan', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiSemana();
    renderApp('/gimnasio/semana');

    expect(await screen.findByRole('heading', { name: 'Semana' })).toBeInTheDocument();
    expect(await screen.findByText('1420 kg')).toBeInTheDocument();

    const musculos = screen.getByRole('region', { name: /series por grupo muscular/i });
    expect(within(musculos).getByText(/pecho/i)).toBeInTheDocument();
    expect(within(musculos).getByText(/3 series/i)).toBeInTheDocument();

    expect(screen.getByText(/2 de 3 sesiones planificadas/i)).toBeInTheDocument();
    expect(screen.getByText(/67 %/)).toBeInTheDocument();
  });
});
