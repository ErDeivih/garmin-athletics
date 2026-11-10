import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'lyfta.token';

const historial = {
  exported_at: '2026-11-10T17:00:00',
  sessions: [
    {
      id: 's-1', name: 'Empuje A', date: '2026-11-10',
      started_at: '2026-11-10T18:00:00', finished_at: '2026-11-10T18:18:00',
      duration_min: 18, total_tonnage_kg: 1420, template_id: 't-1',
      sets_count: 3, exercises_count: 1,
      exercises: [
        {
          exercise_id: 'e-1', exercise_name: 'Press de banca', muscle_group: 'pecho',
          sets: [
            { set_number: 1, weight_kg: 60, reps: 8, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null },
            { set_number: 2, weight_kg: 65, reps: 8, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null },
            { set_number: 3, weight_kg: 70, reps: 6, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null },
          ],
        },
      ],
    },
  ],
};

function apiHistorial() {
  return installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/sessions': json(f.sessions),
    'GET /api/v1/strength/export': json(historial),
  });
}

function prepararDescargas() {
  const descargas: { nombre: string; blob: Blob }[] = [];
  const createObjectURL = vi.fn((blob: Blob) => {
    descargas.push({ nombre: '', blob });
    return 'blob:prueba';
  });
  URL.createObjectURL = createObjectURL;
  URL.revokeObjectURL = vi.fn();
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  return { descargas, click };
}

describe('exportar el historial', () => {
  it('descarga un CSV con una fila por serie', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = apiHistorial();
    const { descargas, click } = prepararDescargas();
    const user = userEvent.setup();
    renderApp('/gimnasio/historial');

    expect(await screen.findByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /exportar csv/i }));

    await waitFor(() => expect(api.calls.some((call) => call.path === '/api/v1/strength/export')).toBe(true));
    await waitFor(() => expect(descargas.length).toBeGreaterThan(0));
    const csv = await descargas[0]!.blob.text();
    const lineas = csv.trim().split('\n');
    expect(lineas[0]).toContain('fecha');
    expect(lineas[0]).toContain('peso_kg');
    // Cabecera + 3 series.
    expect(lineas.length).toBe(4);
    expect(csv).toContain('Press de banca');
    expect(csv).toContain('2026-11-10');

    click.mockRestore();
  });

  it('descarga el JSON completo con las series', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiHistorial();
    const { descargas, click } = prepararDescargas();
    const user = userEvent.setup();
    renderApp('/gimnasio/historial');

    await screen.findByRole('heading', { name: 'Historial' });
    await user.click(screen.getByRole('button', { name: /exportar json/i }));

    await waitFor(() => expect(descargas.length).toBeGreaterThan(0));
    const jsonDescargado = JSON.parse(await descargas[0]!.blob.text());
    expect(jsonDescargado.sessions[0].exercises[0].sets).toHaveLength(3);
    expect(jsonDescargado.sessions[0].exercises[0].sets[1].weight_kg).toBe(65);
    expect(jsonDescargado.sessions[0].total_tonnage_kg).toBe(1420);

    click.mockRestore();
  });
});
