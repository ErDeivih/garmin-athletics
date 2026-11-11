import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';
const ONBOARDING_KEY = 'lyfta.onboarding';

describe('onboarding', () => {
  it('la primera vez explica la app en 3 pasos y qué necesita el reloj', async () => {
    localStorage.clear();
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/metrics/daily': json(f.daily),
      'GET /api/v1/metrics/load': json(f.load),
      'GET /api/v1/alerts': json(f.alerts),
      'GET /api/v1/sync/status': json(f.syncStatus),
    });
    const user = userEvent.setup();
    renderApp('/', { onboarding: false });

    expect(await screen.findByRole('heading', { name: /cómo funciona/i })).toBeInTheDocument();
    // Flujo visual de un vistazo: planifica → envía → entrena.
    expect(screen.getByLabelText(/flujo: planifica/i)).toBeInTheDocument();
    expect(screen.getByText('Planifica')).toBeInTheDocument();
    expect(screen.getByText('Envía')).toBeInTheDocument();
    expect(screen.getByText('Entrena')).toBeInTheDocument();
    expect(screen.getByText(/1\..*plan/i)).toBeInTheDocument();
    expect(screen.getByText(/2\..*env[ií]a/i)).toBeInTheDocument();
    expect(screen.getByText(/3\..*entrena/i)).toBeInTheDocument();
    expect(screen.getByText(/forerunner 255/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /empezar/i }));
    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('visto');

    // La segunda vez ya no aparece.
    renderApp('/');
    await waitFor(() => {
      expect(screen.queryByRole('heading', { name: /cómo funciona/i })).not.toBeInTheDocument();
    });
  });
});
