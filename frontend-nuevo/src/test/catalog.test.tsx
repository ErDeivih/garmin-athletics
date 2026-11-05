import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'pulso.token';

const catalog = {
  total: 2,
  items: [
    {
      id: 'e-1',
      name: 'Press de banca',
      slug: 'press-de-banca',
      muscle_group: 'pecho',
      equipment: 'barra',
      is_timed: false,
      is_unilateral: false,
      secondary_muscles: ['triceps'],
      muscle_group_label: 'Pecho',
      equipment_label: 'Barra',
      notes: null,
      source: 'seed',
      garmin_enum: 'BARBELL_BENCH_PRESS',
      is_custom: false,
    },
    {
      id: 'e-2',
      name: 'Ejercicio propio raro',
      slug: 'ejercicio-propio-raro',
      muscle_group: 'core',
      equipment: 'otro',
      is_timed: false,
      is_unilateral: false,
      secondary_muscles: [],
      muscle_group_label: 'Core',
      equipment_label: 'Otro',
      notes: null,
      source: 'custom',
      garmin_enum: null,
      is_custom: true,
    },
  ],
  muscle_groups: [{ value: 'pecho', label: 'Pecho' }],
  equipment: [{ value: 'barra', label: 'Barra' }],
};

describe('catálogo de ejercicios con dibujos', () => {
  it('muestra el dibujo inicio/fin y avisa cuando un ejercicio no tiene patrón', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/exercises': json(catalog),
    });
    renderApp('/gimnasio/catalogo');

    expect(await screen.findByRole('heading', { name: 'Catálogo' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /dibujo de press de banca/i })).toBeInTheDocument();
    expect(screen.getByText(/sin dibujo para «ejercicio propio raro»/i)).toBeInTheDocument();
    expect(screen.getByText(/^barra$/i)).toBeInTheDocument();
  });

  it('busca en el catálogo y pide los resultados a la API', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/exercises': json(catalog),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/catalogo');

    await screen.findByRole('img', { name: /dibujo de press de banca/i });
    await user.type(screen.getByLabelText(/buscar/i), 'remo');

    const call = api.calls.find(
      (item) => item.path === '/api/v1/strength/exercises' && item.query.get('q') === 'remo',
    );
    expect(call).toBeTruthy();
  });
});
