import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';
const template = f.templates.items[0]!;

describe('biblioteca de entrenamientos', () => {
  it('agrupa la rutina por fases y muestra peso, series y descanso', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates': json(f.templates),
      'GET /api/v1/strength/templates/t-1': json(template),
    });
    const user = userEvent.setup();
    renderApp('/gimnasio/biblioteca');

    expect(await screen.findByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
    const empuje = screen.getByRole('button', { name: /^empuje$/i });
    expect(empuje).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: /empuje a/i }));

    expect(await screen.findByText(/bloque principal/i)).toBeInTheDocument();
    expect(screen.getByText(/4 × 8 · 80 kg/i)).toBeInTheDocument();
    expect(screen.getByText(/descanso 150s/i)).toBeInTheDocument();
    expect(screen.getByText(/serie 1/i)).toBeInTheDocument();
    expect(screen.getAllByText(/80 kg × 8/i).length).toBeGreaterThan(0);
  });
});
