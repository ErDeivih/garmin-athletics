import { screen } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

describe('panel de hoy', () => {
  it('sin datos biométricos no inventa un número: explica qué falta y cómo arreglarlo', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.dailyEmpty),
      'GET /api/v1/metrics/load': json(f.load),
      'GET /api/v1/alerts': json({ date: '2026-11-04', count: 0, alerts: [] }),
      'GET /api/v1/sync/status': json(f.syncStatusUnlinked),
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(await screen.findByText(/sin datos de hoy/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vincular cuenta/i })).toBeInTheDocument();
  });

  it('con datos enseña la disposición y las métricas del día', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/metrics/load': json(f.load),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/');

    expect(await screen.findByText('74')).toBeInTheDocument();
    expect(screen.getAllByText(/sueño/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hrv/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/frescura/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/hrv ha bajado/i)).toBeInTheDocument();
    // Las dos gráficas del panel, con su leyenda legible.
    expect(await screen.findByRole('img', { name: /carga de entrenamiento/i })).toBeInTheDocument();
    expect(screen.getByText(/^forma/i)).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /body battery/i })).toBeInTheDocument();
    expect(screen.getByText(/al despertar 71/i)).toBeInTheDocument();
  });

  it('si la serie de carga falla, el resto del panel sigue en pie', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/metrics/load': json({ detail: 'La serie de carga no está disponible.' }, 500),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/');

    expect(await screen.findByText('74')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudo cargar la carga/i);
  });

  it('si el backend no está, lo dice en español y deja reintentar', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': () => {
        throw new TypeError('Failed to fetch');
      },
      'GET /api/v1/metrics/load': json(f.load),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar tus datos/i);
    expect(screen.getByRole('button', { name: /reintentar/i })).toBeInTheDocument();
  });
});
