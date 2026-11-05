import { screen } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'forja.token';
const FLAG_KEY = 'forja.extended';
const today = new Date();
const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayIso = localIso(today);

const detail = {
  id: 'a-1',
  source: 'garmin',
  type: 'running',
  name: 'Rodaje del río',
  start_time: `${todayIso}T08:00:00`,
  duration_min: 32,
  distance_m: 6200,
  avg_hr: 148,
  max_hr: 166,
  gain_m: 42,
  has_track: true,
  tss: 55,
  rpe: null,
  avg_cadence: 172,
  avg_power: null,
  avg_speed_kmh: 11.6,
  calories: 420,
  loss_m: 40,
  min_alt: 650,
  max_alt: 690,
  bbox: null,
  hr_zones: [{ zone: 2, secs: 900 }, { zone: 3, secs: 600 }],
  weather: { temp_c: 14, feels_like_c: 13, wind_kmh: 8, humidity: 60 },
  laps: [
    { n: 1, distance_m: 1000, duration_s: 300, pace: '5:00 /km', avg_hr: 145, max_hr: 152, gain_m: 4, loss_m: 2, calories: 60, avg_speed: 3.33 },
    { n: 2, distance_m: 1200, duration_s: 360, pace: '5:00 /km', avg_hr: 150, max_hr: 158, gain_m: 6, loss_m: 4, calories: 72, avg_speed: 3.33 },
  ],
};

const streams = {
  activity_id: 'a-1',
  count: 5,
  t_s: [0, 300, 600, 900, 1200],
  dist_m: [0, 1200, 2500, 4000, 5200],
  ele: [650, 655, 660, 657, 670],
  speed_ms: [3.1, 3.2, 3.0, 3.3, 3.1],
  hr: [120, 145, 150, 155, 160],
  pace_sec_km: [null, 300, 310, 305, 300],
};

const splits = {
  activity_id: 'a-1',
  splits: [
    { km: 1, duration_s: 300, pace: '5:00 /km', hr_avg: 145, gain_m: 4 },
    { km: 2, duration_s: 305, pace: '5:05 /km', hr_avg: 150, gain_m: 6 },
  ],
};

const track = {
  activity_id: 'a-1',
  point_count: 5,
  distance_m: 6200,
  gain_m: 42,
  loss_m: 40,
  bbox: null,
  points: {
    lat: [40.97, 40.975, 40.98, 40.985, 40.99],
    lon: [-5.66, -5.655, -5.65, -5.645, -5.64],
  },
};

describe('detalle de una actividad', () => {
  it('muestra recorrido, zonas, series y parciales de una salida con GPS', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(FLAG_KEY, 'true');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/activities': json([detail]),
      'GET /api/v1/activities/a-1': json(detail),
      'GET /api/v1/activities/a-1/streams': json(streams),
      'GET /api/v1/activities/a-1/splits': json(splits),
      'GET /api/v1/activities/a-1/track': json(track),
    });
    renderApp('/actividades/a-1');

    expect(await screen.findByRole('heading', { name: 'Rodaje del río' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /recorrido de la actividad/i })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /^FC: serie temporal/i })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /^Ritmo: serie temporal/i })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: /zonas de frecuencia cardiaca/i })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: /parciales por kilómetro/i })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: /vueltas de la actividad/i })).toBeInTheDocument();
    expect(screen.getByText(/^meteo$/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^5:00 \/km$/).length).toBeGreaterThan(0);
  });
});
