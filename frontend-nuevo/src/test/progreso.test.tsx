import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const progreso = (nombre: string, volumen: number) => ({
  exercise: { id: 'e-1', name: nombre, muscle_group: 'pecho' },
  weeks: [
    { week_start: '2026-10-27', tonnage_kg: 0, sets: 0, sessions: 0, best_set: null },
    { week_start: '2026-11-03', tonnage_kg: volumen, sets: 3, sessions: 1, best_set: { weight_kg: 70, reps: 6, tonnage_kg: 420 } },
  ],
  totals: { tonnage_kg: volumen, sets: 3, best_set: { weight_kg: 70, reps: 6, tonnage_kg: 420 } },
  exercises: [
    { id: 'e-1', name: 'Press de banca', tonnage_kg: volumen },
    { id: 'e-2', name: 'Remo con barra', tonnage_kg: 800 },
  ],
});

function apiProgreso() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/progress': (req) => {
      const id = req.query.get('exercise_id');
      return json(id === 'e-2' ? progreso('Remo con barra', 800) : progreso('Press de banca', 1420));
    },
  });
}

describe('estadísticas de progreso', () => {
  it('muestra volumen por semana, total y mejor serie, y deja cambiar de ejercicio', async () => {    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = apiProgreso();
    const user = userEvent.setup();
    renderApp('/gimnasio/progreso');

    expect(await screen.findByRole('heading', { name: 'Progreso' })).toBeInTheDocument();
    expect((await screen.findAllByText('1420 kg', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/70 kg × 6/).length).toBeGreaterThan(0);
    // Gráfico semanal accesible (no un canvas mudo).
    const grafico = screen.getByRole('img', { name: /volumen por semana/i });
    expect(within(grafico).getAllByText(/kg/).length).toBeGreaterThan(0);

    await user.selectOptions(screen.getByLabelText('Ejercicio'), 'e-2');
    await waitFor(() => {
      expect(api.calls.some((call) => call.path === '/api/v1/strength/progress'
        && call.query.get('exercise_id') === 'e-2')).toBe(true);
    });
    expect((await screen.findAllByText('800 kg', {}, { timeout: 5000 })).length).toBeGreaterThan(0);
  });
});
