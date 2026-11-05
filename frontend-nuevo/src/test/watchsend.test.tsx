import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'forja.token';
const weekday = (new Date().getDay() + 6) % 7;
const templates = {
  ...f.templates,
  items: [{ ...f.templates.items[0], weekday, weekday_label: 'Hoy' }],
};

const preview = {
  status: 'dry_run',
  unmapped_exercises: [] as string[],
  workout_json: {
    workoutName: 'Empuje A',
    sportType: { sportTypeId: 5, sportTypeKey: 'strength_training' },
    estimatedDurationInSecs: 600,
    workoutSegments: [{ segmentOrder: 1, workoutSteps: [{ type: 'RepeatGroupDTO', numberOfIterations: 4 }] }],
  },
  builder: 'garminconnect.workout.StrengthWorkout',
  garmin_catalog_exercises: 1527,
  blocks: 1,
  estimated_seconds: 600,
  push_to_device: true,
  mapping: [
    { name: 'Press de banca', enum: 'BARBELL_BENCH_PRESS', category: 'BENCH_PRESS', exercise: 'BARBELL_BENCH_PRESS' },
  ],
  note: 'Revisa unmapped_exercises.',
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
    'POST /api/v1/strength/push-to-garmin': (req) => {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      return json((body as { dry_run?: boolean }).dry_run === false ? sent : preview);
    },
    ...overrides,
  });
}

describe('envío de la plantilla al reloj', () => {
  it('prepara el envío, exige confirmación y lo manda al reloj', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = install();
    const user = userEvent.setup();
    renderApp('/gimnasio');

    await user.click(await screen.findByRole('button', { name: /preparar envío/i }));
    expect(await screen.findByText(/1 ejercicio · ~10 min/i)).toBeInTheDocument();

    const confirm = screen.getByRole('checkbox', { name: /lo revisaré en el reloj/i });
    const send = screen.getByRole('button', { name: /enviar al reloj/i });
    expect(send).toBeDisabled();
    await user.click(confirm);
    const enabled = screen.getByRole('button', { name: /enviar al reloj/i });
    expect(enabled).toBeEnabled();
    await user.click(enabled);

    expect(await screen.findByText(/enviado. compruébalo en el reloj/i)).toBeInTheDocument();
    const sentCall = api.calls.find(
      (call) => {
        if (call.method !== 'POST' || call.path !== '/api/v1/strength/push-to-garmin') return false;
        const body = typeof call.body === 'string' ? JSON.parse(call.body) : call.body;
        return (body as { dry_run?: boolean }).dry_run === false;
      },
    );
    expect(sentCall).toBeTruthy();
    const sentBody = typeof sentCall?.body === 'string' ? JSON.parse(sentCall.body) : sentCall?.body;
    expect((sentBody as { exercises: { name: string; rest_seconds: number }[] }).exercises[0]).toMatchObject({
      name: 'Press de banca',
      rest_seconds: 150,
    });
  });

  it('si un ejercicio no se puede enviar, no deja mandarlo', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    install({
      'POST /api/v1/strength/push-to-garmin': json({ ...preview, unmapped_exercises: ['Ejercicio raro'] }),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio');

    await user.click(await screen.findByRole('button', { name: /preparar envío/i }));
    expect(await screen.findByText(/no se pueden enviar: ejercicio raro/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('button', { name: /enviar al reloj/i })).toBeNull());
  });
});
