import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  ...f.templates.items[0]!,
  id: 't-offline',
  exercises: [
    {
      ...f.templates.items[0]!.exercises[0]!,
      sets: 2,
      reps: 8,
      weight_kg: 60,
      rest_seconds: 60,
      set_targets: [
        { set_number: 1, weight_kg: 60, reps: 8 },
        { set_number: 2, weight_kg: 65, reps: 8 },
      ],
    },
  ],
};

function apiSesion() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates/t-offline': json(plantilla),
    'GET /api/v1/strength/last-marks': json({ marks: {} }),
  });
}

describe('sesión sin conexión', () => {
  it('avisa de que la sesión se guarda en el móvil, también en modo enfocado', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    apiSesion();
    const user = userEvent.setup();
    renderApp('/gimnasio/entrenar?template=t-offline');

    await screen.findByRole('heading', { name: 'Entrenar' });
    expect(await screen.findByText(/sin conexión/i)).toBeInTheDocument();
    expect(screen.getByText(/se guarda en el móvil/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /modo enfocado/i }));
    await screen.findByRole('heading', { name: 'Serie en curso' });
    expect(screen.getByText(/sin conexión/i)).toBeInTheDocument();

    // Al volver la red, el aviso desaparece.
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    window.dispatchEvent(new Event('online'));
    await waitFor(() => {
      expect(screen.queryByText(/sin conexión/i)).not.toBeInTheDocument();
    });
  });
});
