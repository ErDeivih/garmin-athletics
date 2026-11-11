import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  id: 't-controles',
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
        { set_number: 2, weight_kg: 62.5, reps: 8 },
      ],
    },
  ],
};

const marcas = {
  marks: {
    'e-1': { date: '2026-11-02', weight_kg: 82.5, reps: 6, set_number: 1, rest_seconds: 60 },
  },
};

describe('controles de la pantalla de sesión', () => {
  it('ajusta peso (±2,5 kg) y reps (±1) y recuerda la marca anterior en cada serie', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates/t-controles': json(plantilla),
      'GET /api/v1/strength/last-marks': json(marcas),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/entrenar?template=t-controles');

    await screen.findByRole('heading', { name: 'Entrenar' });
    // «Anterior» bajo cada serie (dos series => dos avisos).
    expect(await screen.findAllByText('Anterior: 82,5 kg × 6')).toHaveLength(2);

    const peso = screen.getByLabelText('Peso serie 1 de Press de banca con barra');
    const reps = screen.getByLabelText('Reps serie 1 de Press de banca con barra');
    expect(peso).toHaveValue('60');
    expect(reps).toHaveValue('8');

    await user.click(screen.getByLabelText('Sumar 2.5 kg a la serie 1 de Press de banca con barra'));
    expect(peso).toHaveValue('62.5');
    await user.click(screen.getByLabelText('Restar 2.5 kg a la serie 1 de Press de banca con barra'));
    expect(peso).toHaveValue('60');

    await user.click(screen.getByLabelText('Añadir una repetición a la serie 1 de Press de banca con barra'));
    expect(reps).toHaveValue('9');
    await user.click(screen.getByLabelText('Quitar una repetición a la serie 1 de Press de banca con barra'));
    expect(reps).toHaveValue('8');
  });

  it('deja editar la siguiente serie con el descanso en marcha', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates/t-controles': json(plantilla),
      'GET /api/v1/strength/last-marks': json(marcas),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/entrenar?template=t-controles');

    await screen.findByRole('heading', { name: 'Entrenar' });
    await user.click(await screen.findByRole('checkbox', { name: /serie 1 de press de banca/i }));

    // Banda de descanso visible (al pie, sin bloquear) y edición posible.
    expect(await screen.findByRole('status')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /saltar descanso/i })).toBeInTheDocument();

    const siguiente = screen.getByLabelText('Peso serie 2 de Press de banca con barra');
    await user.clear(siguiente);
    await user.type(siguiente, '66');
    expect(siguiente).toHaveValue('66');
    // La banda sigue ahí: el descanso no se interrumpe al editar.
    expect(screen.getByRole('button', { name: /saltar descanso/i })).toBeInTheDocument();
  });
});
