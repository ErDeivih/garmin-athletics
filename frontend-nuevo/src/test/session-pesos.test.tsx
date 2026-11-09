import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantillaBase = f.templates.items[0]!;
const ejercicioBase = plantillaBase.exercises[0]!;

/** Plantilla del día con un objetivo distinto por serie: 60 / 65 / 70 kg y 8 / 8 / 6 reps. */
const plantillaConPesos = {
  ...plantillaBase,
  id: 't-pesos',
  exercises: [
    {
      ...ejercicioBase,
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

/**
 * Plantilla sin objetivos por serie (sin `set_targets`): el respaldo es la última
 * marca. Es el caso de los borradores guardados antes de existir los objetivos.
 */
const plantillaSinObjetivos = {
  ...plantillaBase,
  id: 't-sin-objetivos',
  exercises: [{ ...ejercicioBase, sets: 2, reps: 8, weight_kg: 80, set_targets: [] }],
};

function apiDeEntreno(plantilla: typeof plantillaConPesos) {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    [`GET /api/v1/strength/templates/${plantilla.id}`]: json(plantilla),
    'GET /api/v1/strength/last-marks': json(f.lastMarks),
    'POST /api/v1/strength/sessions': json(f.sessionDetail),
  });
}

describe('los pesos por serie llegan a la sesión', () => {
  it('precarga el objetivo de cada serie y lo envía al guardar', async () => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = apiDeEntreno(plantillaConPesos);
    const user = userEvent.setup();
    renderApp('/gimnasio/entrenar?template=t-pesos');

    // La pantalla de entrenar debe arrancar con el plan del día, no con un peso
    // repetido en las tres series: es el camino real (plantilla → borrador → API).
    expect(await screen.findByLabelText(/peso serie 1 de press de banca/i)).toHaveValue('60');
    expect(screen.getByLabelText(/peso serie 2 de press de banca/i)).toHaveValue('65');
    expect(screen.getByLabelText(/peso serie 3 de press de banca/i)).toHaveValue('70');
    expect(screen.getByLabelText(/reps serie 1 de press de banca/i)).toHaveValue('8');
    expect(screen.getByLabelText(/reps serie 2 de press de banca/i)).toHaveValue('8');
    expect(screen.getByLabelText(/reps serie 3 de press de banca/i)).toHaveValue('6');

    for (const numero of [1, 2, 3]) {
      await user.click(screen.getByRole('checkbox', { name: new RegExp(`serie ${numero} de press de banca`, 'i') }));
    }

    // Hay dos botones «Terminar sesión» (arriba y abajo): problema 4 del dossier.
    await user.click(screen.getAllByRole('button', { name: /terminar sesión/i })[0]!);

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'POST' && call.path === '/api/v1/strength/sessions')).toBe(true);
    });
    const llamada = api.calls.find((call) => call.method === 'POST' && call.path === '/api/v1/strength/sessions');
    const cuerpo = typeof llamada?.body === 'string' ? JSON.parse(llamada.body) : llamada?.body;
    expect(cuerpo.sets.map((serie: { weight_kg: number }) => serie.weight_kg)).toEqual([60, 65, 70]);
    expect(cuerpo.sets.map((serie: { reps: number }) => serie.reps)).toEqual([8, 8, 6]);
  });

  it('si la plantilla no trae objetivos por serie, usa la última marca como respaldo', async () => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiDeEntreno(plantillaSinObjetivos);
    renderApp('/gimnasio/entrenar?template=t-sin-objetivos');

    expect(await screen.findByLabelText(/peso serie 1 de press de banca/i)).toHaveValue('82.5');
    expect(screen.getByLabelText(/peso serie 2 de press de banca/i)).toHaveValue('82.5');
  });
});
