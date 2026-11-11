import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  id: 't-editor',
  name: 'Empuje A',
  weekday: 0,
  weekday_label: 'Lunes',
  focus: 'push',
  notes: null,
  total_sets: 2,
  total_reps: 16,
  estimated_tonnage_kg: 980,
  exercises: [
    {
      id: 'te-1',
      position: 0,
      exercise: { id: 'e-1', name: 'Press de banca con barra', slug: 'press-de-banca', muscle_group: 'pecho', equipment: 'barra', is_timed: false, is_unilateral: false },
      sets: 2,
      reps: 8,
      weight_kg: 50,
      rest_seconds: 60,
      notes: null,
      set_targets: [
        { set_number: 1, weight_kg: 50, reps: 8 },
        { set_number: 2, weight_kg: 52.5, reps: 8 },
      ],
    },
  ],
};

const marcas = { marks: {} };

describe('editar el peso en la propia fila', () => {
  it('tocar el campo y salir guarda el nuevo peso sin abrir otra pantalla', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    let actual = plantilla;
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates/t-editor': () => json(actual),
      'GET /api/v1/strength/last-marks': json(marcas),
      'PUT /api/v1/strength/templates/t-editor': (req) => {
        const body = req.body as { exercises: { sets: number; reps: number; weight_kg: number; rest_seconds: number; set_targets: { set_number: number; reps: number; weight_kg: number }[] }[] };
        actual = {
          ...plantilla,
          exercises: plantilla.exercises.map((item, index) => ({
            ...item,
            ...body.exercises[index],
            exercise: item.exercise,
          })),
        };
        return json(actual);
      },
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/plantillas/t-editor');

    await screen.findByRole('heading', { name: /editar pesos/i });
    const campo = await screen.findByLabelText('Peso serie 1 de Press de banca con barra');
    expect(campo).toHaveValue('50');

    await user.clear(campo);
    await user.type(campo, '52,5');
    // Salir del campo es guardar.
    await user.tab();

    await waitFor(() => {
      const llamada = api.calls.filter((call) => call.method === 'PUT' && call.path === '/api/v1/strength/templates/t-editor').pop();
      expect(llamada).toBeTruthy();
      const cuerpo = typeof llamada?.body === 'string' ? JSON.parse(llamada.body) : llamada?.body;
      expect(cuerpo.exercises[0].set_targets[0].weight_kg).toBe(52.5);
    });
    expect(await screen.findByText(/guardado/i)).toBeInTheDocument();
  });
});
