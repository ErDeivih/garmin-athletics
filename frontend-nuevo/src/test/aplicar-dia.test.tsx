import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  ...f.templates.items[0]!,
  id: 't-1',
  name: 'Empuje A',
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

describe('aplicar una plantilla a un día concreto', () => {
  it('crea el evento del calendario con la fecha elegida', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates': json({ total: 1, items: [plantilla] }),
      'GET /api/v1/strength/templates/t-1': json(plantilla),
      'POST /api/v1/calendar/events': json({ status: 'created', id: 'ev-1' }, 201),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/biblioteca');

    await screen.findByRole('heading', { name: 'Biblioteca' });
    await user.click(await screen.findByText('Empuje A'));
    const fecha = await screen.findByLabelText(/día para aplicarla/i);
    await user.type(fecha, '2026-11-20');
    await user.click(screen.getByRole('button', { name: /aplicar al día/i }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'POST' && call.path === '/api/v1/calendar/events')).toBe(true);
    });
    const llamada = api.calls.find((call) => call.method === 'POST' && call.path === '/api/v1/calendar/events');
    const cuerpo = typeof llamada?.body === 'string' ? JSON.parse(llamada.body) : llamada?.body;
    expect(cuerpo.template_id).toBe('t-1');
    expect(cuerpo.start_local).toBe('2026-11-20T18:00:00');
    expect(cuerpo.event_type).toBe('strength');
    expect(await screen.findByText(/añadido al calendario/i)).toBeInTheDocument();
  });
});
