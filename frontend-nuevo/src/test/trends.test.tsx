import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'carga.token';
const FLAG_KEY = 'carga.extended';

const apiConDatos = () =>
  installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/metrics/trends': json(f.trends),
    'GET /api/v1/metrics/load': json(f.load),
    'GET /api/v1/metrics/load-summary': json(f.loadSummary),
    'GET /api/v1/metrics/sleep-phases': json(f.sleepPhases),
    'GET /api/v1/strength/stats': json(f.gymStats),
  });

describe('tendencias y métricas derivadas', () => {
  it('pinta línea, barras, monotonía, calendario, volumen muscular y empuje/tirón', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(FLAG_KEY, 'true');
    apiConDatos();
    renderApp('/tendencias');

    expect(await screen.findByRole('heading', { name: 'Tendencias' })).toBeInTheDocument();
    expect(await screen.findByRole('img', { name: /serie de la métrica/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /carga de entrenamiento/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /carga semanal/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /variación semanal/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /calendario de carga/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /volumen por grupo muscular/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /reparto de volumen/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /fases de sueño por noche/i })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /peso frente a repeticiones/i })).toBeInTheDocument();
    // Cifras del backend, no inventadas.
    expect(screen.getByText(/18\.450 kg totales/i)).toBeInTheDocument();
    expect(screen.getByText(/\+23 % de peso movido que antes/i)).toBeInTheDocument();
  });

  it('cambiar de periodo y de métrica consulta la API con esos parámetros', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(FLAG_KEY, 'true');
    const api = apiConDatos();
    const user = userEvent.setup();
    renderApp('/tendencias');

    await screen.findByRole('img', { name: /carga semanal/i });
    await user.click(screen.getByRole('button', { name: '90 d' }));

    const loadCall = api.calls.find(
      (call) => call.path === '/api/v1/metrics/load' && call.query.get('days') === '90',
    );
    expect(loadCall).toBeTruthy();

    await user.click(screen.getByRole('button', { name: /sueño \(h\)/i }));
    const trendsCall = api.calls.find(
      (call) => call.path === '/api/v1/metrics/trends' && call.query.get('metric') === 'sleep_hours',
    );
    expect(trendsCall).toBeTruthy();
  });

  it('sin datos no pinta series inventadas: cada bloque explica qué falta', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(FLAG_KEY, 'true');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/trends': json(f.trendsEmpty),
      'GET /api/v1/metrics/load': json(f.loadEmpty),
      'GET /api/v1/metrics/load-summary': json(f.loadSummaryEmpty),
      'GET /api/v1/metrics/sleep-phases': json(f.sleepPhasesEmpty),
      'GET /api/v1/strength/stats': json(f.gymStatsEmpty),
    });
    renderApp('/tendencias');

    expect(await screen.findByText(/sin datos para esta métrica/i)).toBeInTheDocument();
    expect(screen.getByText(/sin carga semanal en el periodo/i)).toBeInTheDocument();
    expect(screen.getByText(/sin volumen clasificado de empuje o tirón/i)).toBeInTheDocument();
    expect(screen.getByText(/sin noches con fases de sueño reales/i)).toBeInTheDocument();
    expect(screen.getByText(/faltan series de trabajo para dibujar la dispersión/i)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /serie de la métrica/i })).toBeNull();
    expect(screen.queryByRole('img', { name: /carga semanal/i })).toBeNull();
    expect(screen.queryByRole('img', { name: /fases de sueño por noche/i })).toBeNull();
  });
});
