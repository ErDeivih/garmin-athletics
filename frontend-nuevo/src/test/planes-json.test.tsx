import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const plantilla = {
  ...f.templates.items[0]!,
  id: 't-1',
  exercises: [
    {
      ...f.templates.items[0]!.exercises[0]!,
      sets: 3,
      reps: 8,
      weight_kg: 60,
      set_targets: [
        { set_number: 1, weight_kg: 60, reps: 8 },
        { set_number: 2, weight_kg: 65, reps: 8 },
        { set_number: 3, weight_kg: 70, reps: 6 },
      ],
    },
  ],
};

const exportado = {
  version: 1,
  exported_at: '2026-11-10T10:00:00.000Z',
  app: 'Lyfta',
  templates: [
    {
      name: 'Pierna D',
      weekday: 2,
      focus: 'legs',
      notes: null,
      exercises: [
        {
          exercise_id: 'e-1',
          sets: 2,
          reps: 10,
          weight_kg: 80,
          rest_seconds: 90,
          set_targets: [
            { set_number: 1, weight_kg: 80, reps: 10 },
            { set_number: 2, weight_kg: 85, reps: 10 },
          ],
        },
      ],
    },
  ],
};

function apiBiblioteca() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates': json({ total: 1, items: [plantilla] }),
    'GET /api/v1/strength/templates/t-1': json(plantilla),
    'POST /api/v1/strength/templates': (req) => json(req.body, 201),
  });
}

describe('exportar e importar planes en JSON', () => {
  it('exporta los planes con sus pesos por serie', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiBiblioteca();
    const descargas: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => {
      descargas.push(blob);
      return 'blob:prueba';
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = createObjectURL;
    URL.revokeObjectURL = vi.fn();

    const user = userEvent.setup();
    renderApp('/gimnasio/biblioteca');
    await screen.findByRole('heading', { name: 'Biblioteca' });

    await user.click(screen.getByRole('button', { name: /exportar planes/i }));
    await waitFor(() => expect(createObjectURL).toHaveBeenCalled());
    const texto = await descargas[0]!.text();
    const jsonExportado = JSON.parse(texto);
    expect(jsonExportado.version).toBe(1);
    expect(jsonExportado.templates[0].name).toBe('Empuje A');
    expect(jsonExportado.templates[0].exercises[0].set_targets.map((t: { weight_kg: number }) => t.weight_kg))
      .toEqual([60, 65, 70]);
    expect(click).toHaveBeenCalled();

    click.mockRestore();
  });

  it('importa un JSON y crea los planes con sus series', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = apiBiblioteca();
    const user = userEvent.setup();
    renderApp('/gimnasio/biblioteca');
    await screen.findByRole('heading', { name: 'Biblioteca' });

    const archivo = new File([JSON.stringify(exportado)], 'planes.json', { type: 'application/json' });
    await user.upload(screen.getByLabelText(/importar planes/i), archivo);

    await waitFor(() => {
      expect(api.calls.some((call) => call.method === 'POST' && call.path === '/api/v1/strength/templates')).toBe(true);
    });
    const llamada = api.calls.find((call) => call.method === 'POST' && call.path === '/api/v1/strength/templates');
    const cuerpo = typeof llamada?.body === 'string' ? JSON.parse(llamada.body) : llamada?.body;
    expect(cuerpo.name).toBe('Pierna D');
    expect(cuerpo.exercises[0].set_targets.map((t: { weight_kg: number }) => t.weight_kg)).toEqual([80, 85]);
    expect(await screen.findByText(/1 plan importado/i)).toBeInTheDocument();
  });
});
