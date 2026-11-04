import { screen } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'garmin-athletics.token';

describe('panel de hoy', () => {
  it('sin datos biométricos no inventa un número: explica qué falta y cómo arreglarlo', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.dailyEmpty),
      'GET /api/v1/alerts': json({ date: '2026-11-04', count: 0, alerts: [] }),
      'GET /api/v1/sync/status': json(f.syncStatusUnlinked),
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(await screen.findByText(/sin datos de hoy/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /vincular garmin/i })).toBeInTheDocument();
  });

  it('con datos enseña la disposición y sus tres componentes', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/');

    expect(await screen.findByText('74')).toBeInTheDocument();
    expect(screen.getAllByText(/sueño/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/hrv/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/tsb/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/hrv ha bajado/i)).toBeInTheDocument();
  });
});
