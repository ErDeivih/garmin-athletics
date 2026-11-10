import { screen, within } from '@testing-library/react';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';
const weekday = (new Date().getDay() + 6) % 7;
const templates = {
  ...f.templates,
  items: [{ ...f.templates.items[0], weekday, weekday_label: 'Hoy' }],
};

function instalar() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates': json(templates),
    'GET /api/v1/strength/templates/t-1': json(f.templates.items[0]),
    'GET /api/v1/strength/sessions': json(f.sessions),
  });
}

describe('aviso de lo que falta para el reloj real', () => {
  it('pinta una tarjeta visible con los pasos y el Forerunner 255', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    instalar();
    renderApp('/gimnasio');

    // Tarjeta propia, no un mensaje escondido en un desplegable ni un `title`.
    const tarjeta = await screen.findByRole('region', { name: /reloj real/i });
    expect(tarjeta).toBeVisible();
    expect(within(tarjeta).getByRole('heading', { name: /reloj real/i })).toBeInTheDocument();
    expect(within(tarjeta).getByText(/forerunner 255/i)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/2fa/i)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/hacer una serie/i)).toBeInTheDocument();
    expect(within(tarjeta).getByText(/pendiente/i)).toBeInTheDocument();
  });

  it('no aparece en otras pantallas', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/metrics/load': json(f.load),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    renderApp('/');

    expect(await screen.findByRole('heading', { name: /^Hoy$/ })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: /reloj real/i })).not.toBeInTheDocument();
  });
});
