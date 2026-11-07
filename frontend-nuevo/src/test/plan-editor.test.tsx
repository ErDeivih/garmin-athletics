import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

describe('editar pesos al planificar', () => {
  it('cambia el peso de una serie con un toque y lo guarda', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates/t-1': json(f.templates.items[0]),
      'GET /api/v1/strength/last-marks': json(f.lastMarks),
      'PUT /api/v1/strength/templates/t-1': json(f.templates.items[0]),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/plantillas/t-1');

    expect(await screen.findByRole('heading', { name: /editar pesos/i })).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /subir peso serie 1 de press de banca/i }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'PUT' && call.path === '/api/v1/strength/templates/t-1')).toBe(true);
    });
    const call = api.calls.find((item) => item.method === 'PUT' && item.path === '/api/v1/strength/templates/t-1');
    const body = typeof call?.body === 'string' ? JSON.parse(call.body) : call?.body;
    expect(body.exercises[0].set_targets[0].weight_kg).toBe(85);
  });
});
