import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  id: 't-foco',
  name: 'Empuje A',
  weekday: 0,
  weekday_label: 'Lunes',
  focus: 'push',
  notes: null,
  total_sets: 2,
  total_reps: 16,
  estimated_tonnage_kg: 980,
  exercises: [
    {
      id: 'te-1',
      position: 0,
      exercise: { id: 'e-1', name: 'Press de banca con barra', slug: 'press-de-banca', muscle_group: 'pecho', equipment: 'barra', is_timed: false, is_unilateral: false },
      sets: 2,
      reps: 8,
      weight_kg: 60,
      rest_seconds: 60,
      notes: null,
      set_targets: [
        { set_number: 1, weight_kg: 60, reps: 8 },
        { set_number: 2, weight_kg: 65, reps: 8 },
      ],
    },
  ],
};

const sesionGuardada = {
  id: 's-foco',
  name: 'Empuje A',
  template_id: 't-foco',
  date: '2026-11-10',
  started_at: '2026-11-10T20:00:00',
  finished_at: '2026-11-10T20:20:00',
  duration_min: 20,
  total_tonnage_kg: 980,
  computed_tss: 0,
  sets_count: 2,
  exercises_count: 1,
  notes: 'Buenas sensaciones',
  status: 'saved',
  activity_id: null,
  exercises: [],
};

const marcas = {
  marks: {
    'e-1': { date: '2026-11-02', weight_kg: 60, reps: 8, set_number: 1, rest_seconds: 60 },
  },
};

describe('modo enfocado en el gimnasio', () => {
  it('guía serie a serie, registra reps/RPE y guarda la nota al terminar', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates/t-foco': json(plantilla),
      'GET /api/v1/strength/last-marks': json(marcas),
      'POST /api/v1/strength/sessions': json(sesionGuardada, 201),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/entrenar?template=t-foco');

    await screen.findByRole('heading', { name: 'Entrenar' });
    await user.click(await screen.findByRole('button', { name: /modo enfocado/i }));

    // Una sola serie a la vista, con objetivo grande.
    expect(await screen.findByRole('heading', { name: 'Serie en curso' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Press de banca con barra' })).toBeInTheDocument();
    expect(screen.getByLabelText('Serie 1 de 2')).toBeInTheDocument();
    expect(screen.getByText('60 kg')).toBeInTheDocument();
    // Calculadora de discos: 60 kg = barra de 20 + un disco de 20 por lado.
    expect(screen.getByText(/discos:/i)).toBeInTheDocument();
    expect(screen.getByText(/20 por lado/i)).toBeInTheDocument();

    // Registro rápido: reps reales (7 en vez de 8) y RPE opcional.
    await user.click(screen.getByRole('button', { name: /^serie hecha$/i }));
    const reps = await screen.findByLabelText(/repeticiones reales/i);
    expect(reps).toHaveValue(8);
    await user.clear(reps);
    await user.type(reps, '7');
    await user.click(screen.getByRole('button', { name: /rpe 8/i }));
    await user.click(screen.getByRole('button', { name: /confirmar serie/i }));

    // Descanso con temporizador y salto manual.
    expect(await screen.findByText(/^descanso$/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /saltar descanso/i }));

    // Segunda serie con su propio objetivo.
    expect(screen.getByLabelText('Serie 2 de 2')).toBeInTheDocument();
    expect(screen.getByText('65 kg')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /^serie hecha$/i }));
    await user.click(await screen.findByRole('button', { name: /confirmar serie/i }));

    // Registro final: nota opcional y guardar.
    expect(await screen.findByRole('heading', { name: /sesión completada/i })).toBeInTheDocument();
    await user.type(screen.getByLabelText(/nota \(opcional\)/i), 'Buenas sensaciones');
    await user.click(screen.getByRole('button', { name: /terminar y guardar/i }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'POST' && call.path === '/api/v1/strength/sessions')).toBe(true);
    });
    const llamada = api.calls.find((call) => call.method === 'POST' && call.path === '/api/v1/strength/sessions');
    const cuerpo = typeof llamada?.body === 'string' ? JSON.parse(llamada.body) : llamada?.body;
    expect(cuerpo.notes).toBe('Buenas sensaciones');
    expect(cuerpo.sets).toHaveLength(2);
    expect(cuerpo.sets[0]).toMatchObject({ weight_kg: 60, reps: 7, rpe: 8 });
    expect(cuerpo.sets[1]).toMatchObject({ weight_kg: 65, reps: 8, rpe: null });
  });
});
