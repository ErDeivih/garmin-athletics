import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';
const UNITS_KEY = 'lyfta.units';

const plantillaConPesos = {
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

describe('ajustes: unidades', () => {
  it('cambia a libras y los pesos se muestran en lb', async () => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/sync/status': json(f.syncStatus),
      'GET /api/v1/strength/templates/t-pesos': json(plantillaConPesos),
      'GET /api/v1/strength/last-marks': json({ marks: {} }),
    });
    const user = userEvent.setup();
    renderApp('/ajustes');

    expect(await screen.findByRole('heading', { name: 'Ajustes' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /libras/i }));
    expect(localStorage.getItem(UNITS_KEY)).toBe('lb');

    // En el editor del plan, 60 kg se muestran como 132,3 lb en el campo de la fila.
    renderApp('/gimnasio/plantillas/t-pesos');
    const campo = await screen.findByLabelText(/^peso serie 1 de/i);
    expect(campo).toHaveValue('132,3');
    expect(screen.queryByDisplayValue('60')).not.toBeInTheDocument();
  });

  it('avisa de que la app funciona sin conexión', async () => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/ajustes');

    expect(await screen.findByText(/funciona sin conexión/i)).toBeInTheDocument();
  });
});
