import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = (id: string, name: string, focus: string, updated: string) => ({
  ...f.templates.items[0]!,
  id,
  name,
  focus,
  updated_at: updated,
  exercises: [{ ...f.templates.items[0]!.exercises[0]!, id: `${id}-e1` }],
});

const empuje = plantilla('t-empuje', 'Empuje A', 'push', '2026-11-10T09:00:00');
const tiron = plantilla('t-tiron', 'Tirón B', 'pull', '2026-10-01T09:00:00');
const pierna = plantilla('t-pierna', 'Pierna C', 'legs', '2026-11-09T09:00:00');

/** Filtra como el backend: texto en el nombre, foco y rango de fechas. */
function bibliotecaFiltrada() {
  let items = [empuje, tiron, pierna];
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates': (req) => {
      const q = (req.query.get('q') ?? '').toLowerCase();
      const focus = req.query.get('focus');
      const from = req.query.get('from');
      const to = req.query.get('to');
      const filtradas = items.filter((item) =>
        item.name.toLowerCase().includes(q)
        && (!focus || item.focus.toLowerCase() === focus.toLowerCase())
        && (!from || item.updated_at.slice(0, 10) >= from)
        && (!to || item.updated_at.slice(0, 10) <= to));
      return json({ total: filtradas.length, items: filtradas });
    },
    'POST /api/v1/strength/templates/t-empuje/duplicate': () => {
      const copia = plantilla('t-copia', 'Empuje A (copia)', 'push', '2026-11-10T10:00:00');
      items = [...items, copia];
      return json(copia, 201);
    },
    'GET /api/v1/strength/templates/t-empuje': json(empuje),
    'GET /api/v1/strength/sessions': json(f.sessions),
  });
}

describe('biblioteca de entrenamientos', () => {
  it('busca por nombre, filtra por foco y por fecha', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = bibliotecaFiltrada();
    const user = userEvent.setup();
    renderApp('/gimnasio/biblioteca');

    expect(await screen.findByRole('heading', { name: 'Biblioteca' })).toBeInTheDocument();
    expect(await screen.findByText('Empuje A')).toBeInTheDocument();

    const buscar = screen.getByLabelText(/buscar por nombre/i);
    await user.type(buscar, 'tirón');
    await waitFor(() => {
      expect(screen.getByText('Tirón B')).toBeInTheDocument();
      expect(screen.queryByText('Empuje A')).not.toBeInTheDocument();
    });

    await user.clear(buscar);
    await user.click(screen.getByRole('button', { name: /^pierna$/i }));
    await waitFor(() => {
      expect(screen.getByText('Pierna C')).toBeInTheDocument();
      expect(screen.queryByText('Tirón B')).not.toBeInTheDocument();
    });

    // La fecha se manda al servidor (no se filtra en el cliente).
    const desde = screen.getByLabelText(/^desde$/i);
    await user.type(desde, '2026-11-01');
    await waitFor(() => {
      expect(api.calls.some((call) => call.path === '/api/v1/strength/templates'
        && call.query.get('from') === '2026-11-01')).toBe(true);
    });

    await user.click(screen.getByRole('button', { name: /quitar filtros/i }));
    await waitFor(() => {
      expect(screen.getByText('Empuje A')).toBeInTheDocument();
      expect(screen.getByText('Tirón B')).toBeInTheDocument();
    });
  });

  it('duplica un plan para reutilizarlo', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = bibliotecaFiltrada();
    const user = userEvent.setup();
    renderApp('/gimnasio/biblioteca');

    await screen.findByRole('heading', { name: 'Biblioteca' });
    await user.click(await screen.findByRole('button', { name: /Empuje A/i }));
    await user.click(await screen.findByRole('button', { name: /duplicar plan/i }));

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'POST'
        && call.path === '/api/v1/strength/templates/t-empuje/duplicate')).toBe(true);
    });
    expect(await screen.findByText(/copia creada/i)).toBeInTheDocument();
    expect(await screen.findByText('Empuje A (copia)')).toBeInTheDocument();
  });
});
