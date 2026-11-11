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
            { set_number: 1, weight_kg: 60, reps: 8, planned_weight_kg: 60, planned_reps: 8, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null },
            { set_number: 2, weight_kg: 65, reps: 8, planned_weight_kg: 65, planned_reps: 8, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null },
            { set_number: 3, weight_kg: 70, reps: 6, planned_weight_kg: 70, planned_reps: 6, rpe: null, is_warmup: false, set_type: 'normal', rest_seconds: 60, completed_at: null },
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
    const cabecera = lineas[0]!.split(',');
    expect(cabecera).toEqual([
      'fecha', 'sesion_id', 'sesion', 'ejercicio', 'grupo_muscular', 'serie',
      'unidad', 'peso_previsto', 'peso_real', 'reps_previstas', 'reps_reales',
      'dif', 'rpe', 'calentamiento', 'duracion_min', 'volumen_sesion',
    ]);
    // Cabecera + 3 series = 3 filas correctas.
    expect(lineas.length).toBe(4);
    const fila = (numero: number) => {
      const valores = lineas[numero]!.split(',');
      return Object.fromEntries(cabecera.map((columna, indice) => [columna, valores[indice]]));
    };
    expect(fila(1)).toMatchObject({
      fecha: '2026-11-10', sesion_id: 's-1', sesion: 'Empuje A',
      ejercicio: 'Press de banca', grupo_muscular: 'pecho', serie: '1', unidad: 'kg',
      peso_previsto: '60', peso_real: '60', reps_previstas: '8', reps_reales: '8', dif: '0',
    });
    expect(fila(2)).toMatchObject({ serie: '2', peso_previsto: '65', peso_real: '65', dif: '0' });
    expect(fila(3)).toMatchObject({ serie: '3', peso_previsto: '70', peso_real: '70', reps_previstas: '6', reps_reales: '6' });

    click.mockRestore();
  });

  it('con la app en libras el CSV sale en lb y lo dice en la columna unidad', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem('lyfta.units', 'lb');
    apiHistorial();
    const { descargas, click } = prepararDescargas();
    const user = userEvent.setup();
    renderApp('/gimnasio/historial');

    await screen.findByRole('heading', { name: 'Historial' });
    await user.click(screen.getByRole('button', { name: /exportar csv/i }));
    await waitFor(() => expect(descargas.length).toBeGreaterThan(0));
    const lineas = (await descargas[0]!.blob.text()).trim().split('\n');
    expect(lineas[1]).toContain(',lb,132.3,132.3,8,8,0,');
    expect(lineas[3]).toContain(',lb,154.3,154.3,6,6,0,');

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
