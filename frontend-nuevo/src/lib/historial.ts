import type { HistoryExportResponse } from '../api/types';

/**
 * Exportación del historial para análisis fuera de la app: una fila por serie
 * en CSV (lo que pide una hoja de cálculo) y el JSON completo tal cual.
 */
const COLUMNAS = [
  'fecha',
  'sesion',
  'ejercicio',
  'grupo_muscular',
  'serie',
  'peso_previsto_kg',
  'peso_real_kg',
  'reps_previstas',
  'reps_reales',
  'dif_kg',
  'rpe',
  'calentamiento',
  'duracion_min',
  'volumen_sesion_kg',
];

function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\n;]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

export function buildHistoryCsv(datos: HistoryExportResponse): string {
  const filas: string[] = [COLUMNAS.join(',')];
  for (const sesion of datos.sessions) {
    for (const ejercicio of sesion.exercises) {
      for (const serie of ejercicio.sets) {
        const planificado = serie.planned_weight_kg;
        const diferencia = planificado === null || planificado === undefined
          ? ''
          : Number((serie.weight_kg - planificado).toFixed(2));
        filas.push([
          sesion.date ?? '',
          sesion.name,
          ejercicio.exercise_name,
          ejercicio.muscle_group ?? '',
          serie.set_number,
          planificado ?? '',
          serie.weight_kg,
          serie.planned_reps ?? '',
          serie.reps,
          diferencia,
          serie.rpe ?? '',
          serie.is_warmup ? 'si' : 'no',
          sesion.duration_min ?? '',
          sesion.total_tonnage_kg,
        ].map(celda).join(','));
      }
    }
  }
  return `${filas.join('\n')}\n`;
}

/** Descarga un texto (CSV/JSON) con el nombre dado. */
export function downloadText(filename: string, contenido: string, mime: string): void {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = filename;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

export function nombreExportacion(extension: 'csv' | 'json'): string {
  const fecha = new Date().toISOString().slice(0, 10);
  return `lyfta-historial-${fecha}.${extension}`;
}
