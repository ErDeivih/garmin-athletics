import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  ...f.templates.items[0]!,
  id: 't-pesos',
  exercises: [
    {
      ...f.templates.items[0]!.exercises[0]!,
      sets: 3,
      reps: 8,
      weight_kg: 60,
      set_targets: [
        { set_number: 1, weight_kg: 60, reps: 8 },
        { set_number: 2, weight_kg: 65, reps: 8 },
        { set_number: 3, weight_kg: 70, reps: 6 },
      ],
    },
  ],
};

function apiEditor() {
  // El PUT real devuelve la plantilla guardada y el GET la sirve igual: si el
  // falso devolviera siempre la original, la pantalla revertiría el cambio.
  let actual = plantilla;
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates/t-pesos': () => json(actual),
    'GET /api/v1/strength/last-marks': json({ marks: {} }),
    'PUT /api/v1/strength/templates/t-pesos': (req) => {
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
}

describe('editor de pesos más rápido', () => {
  it('copia el peso de la serie anterior', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiEditor();
    const user = userEvent.setup();
    renderApp('/gimnasio/plantillas/t-pesos');

    expect(await screen.findByDisplayValue('65')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {
      name: /copiar peso de la serie anterior a la serie 2 de press de banca/i,
    }));

    await waitFor(() => {
      expect(screen.getAllByDisplayValue('60').length).toBeGreaterThanOrEqual(2);
      expect(screen.queryAllByDisplayValue('65')).toHaveLength(0);
    });
  });

  it('aplica un peso a todas las series y lo guarda sin salir', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = apiEditor();
    const user = userEvent.setup();
    renderApp('/gimnasio/plantillas/t-pesos');

    const enBloque = await screen.findByLabelText(/peso para todas las series de press de banca/i);
    await user.clear(enBloque);
    await user.type(enBloque, '80');
    await user.click(screen.getByRole('button', { name: /aplicar a todas/i }));

    await waitFor(() => {
      const valores = screen.getAllByLabelText(/^peso serie \d de/i).map((input) => (input as HTMLInputElement).value);
      expect(valores).toEqual(['80', '80', '80']);
    });

    // Se guarda solo, sin botón de guardar y sin salir de la pantalla.
    await waitFor(() => {
      const guardado = api.calls.find((call) => call.method === 'PUT'
        && call.path === '/api/v1/strength/templates/t-pesos');
      expect(guardado).toBeTruthy();
      const cuerpo = typeof guardado?.body === 'string' ? JSON.parse(guardado.body) : guardado?.body;
      expect(cuerpo.exercises[0].set_targets.map((t: { weight_kg: number }) => t.weight_kg))
        .toEqual([80, 80, 80]);
    });
    expect(await screen.findByText(/guardado a las/i)).toBeInTheDocument();
  });
});
