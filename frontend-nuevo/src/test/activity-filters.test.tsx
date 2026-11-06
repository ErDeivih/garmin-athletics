import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';
const FLAG_KEY = 'lyfta.extended';

const activities = [
  {
    id: 'a-run',
    source: 'garmin',
    type: 'running',
    name: 'Rodaje del río',
    start_time: '2026-11-04T08:00:00',
    duration_min: 32,
    distance_m: 6200,
    avg_hr: 148,
    max_hr: 166,
    gain_m: 42,
    has_track: true,
    tss: 55,
    rpe: null,
  },
  {
    id: 'a-bike',
    source: 'garmin',
    type: 'cycling',
    name: 'Vuelta en bici',
    start_time: '2026-11-03T17:00:00',
    duration_min: 45,
    distance_m: 18000,
    avg_hr: 132,
    max_hr: 155,
    gain_m: 120,
    has_track: true,
    tss: 40,
    rpe: null,
  },
];

describe('filtros de Actividades', () => {
  it('filtra por deporte y por texto contra la API', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(FLAG_KEY, 'true');
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/activities': () => json(activities),
    });
    const user = userEvent.setup();
    renderApp('/actividades');

    expect(await screen.findByText('Rodaje del río')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Bici' }));
    const sportCall = api.calls.find(
      (item) => item.path === '/api/v1/activities' && item.query.get('sport') === 'cycling',
    );
    expect(sportCall).toBeTruthy();

    const search = screen.getByLabelText(/buscar/i);
    await user.type(search, 'rodaje');
    const textCall = api.calls.find(
      (item) => item.path === '/api/v1/activities' && item.query.get('q') === 'rodaje',
    );
    expect(textCall).toBeTruthy();
    expect(screen.getByRole('button', { name: /quitar filtros/i })).toBeInTheDocument();
  });
});
