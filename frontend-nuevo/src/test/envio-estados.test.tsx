import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  ...f.templates.items[0]!,
  id: 't-envio',
  name: 'Empuje A',
  // El gimnasio solo ofrece enviar la plantilla del día.
  weekday: (new Date().getDay() + 6) % 7,
  exercises: [
    {
      ...f.templates.items[0]!.exercises[0]!,
      sets: 1,
      reps: 8,
      weight_kg: 60,
      rest_seconds: 60,
      set_targets: [{ set_number: 1, weight_kg: 60, reps: 8 }],
    },
  ],
};

let ackConfirmado = false;

function apiEnvio() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates': json({ total: 1, items: [plantilla] }),
    'GET /api/v1/strength/templates/t-envio': json(plantilla),
    'GET /api/v1/strength/last-marks': json({ marks: {} }),
    'GET /api/v1/strength/sessions': json(f.sessions),
    'GET /api/v1/strength/watch-today': json({ status: 'no_workout', name: null, exercises: [] }),
    'POST /api/v1/strength/push-to-garmin': json({
      status: 'sent',
      unmapped_exercises: [],
      garmin_response: { workoutId: 'w-1' },
      pushed_to_device: { ok: true },
      note: 'subido',
    }),
    'GET /api/v1/watch/ack': () => json({
      confirmed: ackConfirmado,
      sets_count: ackConfirmado ? 2 : 0,
      last_set_at: ackConfirmado ? '2026-11-11T13:10:00' : null,
      workout_id: ackConfirmado ? 'w-1' : null,
    }),
  });
}

describe('estados del envío al reloj', () => {
  it('distingue Solicitado, Enviado y Confirmado, y nunca muestra «Recibido» sin acuse', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    ackConfirmado = false;
    const api = apiEnvio();
    const user = userEvent.setup();
    renderApp('/gimnasio');

    await screen.findByRole('heading', { name: 'Gimnasio' });
    await user.click(await screen.findByRole('button', { name: /^enviar al reloj$/i }));

    // Garmin acepta el entreno, pero el reloj aún no ha confirmado.
    expect(await screen.findByText('Enviado a Garmin')).toBeInTheDocument();
    expect(screen.queryByText(/^recibido$/i)).not.toBeInTheDocument();
    expect(screen.getByText(/falta que el reloj confirme/i)).toBeInTheDocument();
    expect(screen.getAllByText('Enviado').length).toBeGreaterThan(0);
    // Reintento disponible también cuando ya está enviado (por si hay que reenviar).
    expect(screen.getByRole('button', { name: /reenviar al reloj/i })).toBeInTheDocument();

    // Ahora el reloj devuelve series: la app puede confirmar.
    ackConfirmado = true;
    await user.click(screen.getByRole('button', { name: /^enviar al reloj$/i }));
    await waitFor(() => expect(screen.getAllByText('Confirmado').length).toBeGreaterThan(0), { timeout: 10000 });
    expect(screen.getByText(/confirmado por el reloj/i)).toBeInTheDocument();
    expect(screen.getByText(/ha devuelto 2 series/i)).toBeInTheDocument();
    expect(api.calls.some((call) => call.path === '/api/v1/watch/ack')).toBe(true);
  }, 20000);
});
