import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

describe('corregir el peso real despuÃ©s de la sesiÃ³n', () => {
  it('edita una serie y envÃ­a el peso corregido', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/sessions/s-new': json(f.sessionDetail),
      'PUT /api/v1/strength/sessions/s-new': json(f.sessionDetail),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/sesiones/s-new');

    expect(await screen.findByRole('heading', { name: /editar pesos reales/i })).toBeInTheDocument();
    const weight = await screen.findByLabelText(/peso \(kg\)/i);
    await user.clear(weight);
    await user.type(weight, '82.5');
    await user.click(screen.getByRole('button', { name: /guardar pesos reales/i }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'PUT' && call.path === '/api/v1/strength/sessions/s-new')).toBe(true);
    });
    const call = api.calls.find((item) => item.method === 'PUT' && item.path === '/api/v1/strength/sessions/s-new');
    const body = typeof call?.body === 'string' ? JSON.parse(call.body) : call?.body;
    expect(body.sets[0].weight_kg).toBe(82.5);
  });
});

