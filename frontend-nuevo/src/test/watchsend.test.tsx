import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';
const weekday = (new Date().getDay() + 6) % 7;
const templates = {
  ...f.templates,
  items: [{ ...f.templates.items[0], weekday, weekday_label: 'Hoy' }],
};

const sent = {
  status: 'sent',
  unmapped_exercises: [],
  garmin_response: { workoutId: 12345 },
  pushed_to_device: { ok: true },
  note: 'Enviado.',
};

function install(overrides: Record<string, unknown> = {}) {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates': json(templates),
    'GET /api/v1/strength/templates/t-1': json(f.templates.items[0]),
    'GET /api/v1/strength/sessions': json(f.sessions),
    'GET /api/v1/watch/ack': json({ confirmed: false, sets_count: 0, last_set_at: null, workout_id: null }),
    'POST /api/v1/strength/push-to-garmin': json(sent),
    ...overrides,
  });
}

describe('envío de la plantilla al reloj', () => {
  it('manda el entreno desde Lyfta y muestra el estado enviado', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = install();
    const user = userEvent.setup();
    renderApp('/gimnasio');

    expect((await screen.findAllByText(/^solicitado$/i)).length).toBeGreaterThan(0);
    await user.click(await screen.findByRole('button', { name: /^enviar al reloj$/i }));
    expect(await screen.findByText(/enviado a garmin/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^enviado$/i).length).toBeGreaterThan(0);
    // Sin acuse del reloj no se muestra la tarjeta de confirmación.
    expect(screen.queryByText(/^recibido$/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/confirmado por el reloj/i)).not.toBeInTheDocument();

    const sentCall = api.calls.find(
      (call) => call.method === 'POST' && call.path === '/api/v1/strength/push-to-garmin',
    );
    expect(sentCall).toBeTruthy();
    const sentBody = typeof sentCall?.body === 'string' ? JSON.parse(sentCall.body) : sentCall?.body;
    expect((sentBody as { dry_run?: boolean }).dry_run).toBe(false);
    expect((sentBody as { exercises: { name: string; rest_seconds: number }[] }).exercises[0]).toMatchObject({
      name: 'Press de banca',
      rest_seconds: 150,
    });
  });

  it('si el envío falla, explica qué hacer y deja reintentar', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    install({
      'POST /api/v1/strength/push-to-garmin': json({ detail: 'El reloj no está disponible.' }, 500),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio');

    await user.click(await screen.findByRole('button', { name: /^enviar al reloj$/i }));
    expect(await screen.findByText(/no se pudo enviar/i)).toBeInTheDocument();
    expect(screen.getByText(/^error$/i)).toBeInTheDocument();
    expect(await screen.findByText(/acerca el reloj, sincroniza/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
