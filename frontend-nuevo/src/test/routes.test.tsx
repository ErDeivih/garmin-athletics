import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'pulso.token';

const generated = {
  id: 'route-1',
  name: 'Vuelta al parque',
  sport: 'running',
  distance_m: 8000,
  gain_m: 120,
  loss_m: 110,
  points: 400,
  created_at: '2026-11-05T18:00:00',
  lat: [40.4168, 40.425, 40.41],
  lon: [-3.7038, -3.69, -3.68],
  ele: [650, 690, 660],
  effort: 'moderate',
  estimated_duration_s: 2880,
  splits: [
    { km: 1, distance_m: 1000, gain_m: 20, pace: '5:30 /km', speed_kmh: 10.9, duration_s: 330 },
    { km: 2, distance_m: 1000, gain_m: 30, pace: '6:00 /km', speed_kmh: 10, duration_s: 360 },
  ],
  checkpoints: [
    { lat: 40.4168, lon: -3.7038, ele: 650 },
    { lat: 40.425, lon: -3.69, ele: 690 },
  ],
};

describe('generador de rutas', () => {
  it('genera el recorrido y enseña el perfil y el ritmo por kilómetro', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem('pulso.extended', 'true');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/routes/': json([]),
      'GET /api/v1/routes/route-1': json(generated),
      'POST /api/v1/routes/generate': json(generated),
    });
    const user = userEvent.setup();
    renderApp('/rutas');

    expect(await screen.findByRole('heading', { name: 'Rutas' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /generar ruta/i }));

    expect(await screen.findByText('Vuelta al parque')).toBeInTheDocument();
    expect(await screen.findByText('5:30 /km')).toBeInTheDocument();
    const call = api.calls.find((item) => item.method === 'POST' && item.path === '/api/v1/routes/generate');
    expect(call).toBeTruthy();
  });
});
