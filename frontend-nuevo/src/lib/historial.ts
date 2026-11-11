import type { HistoryExportResponse } from '../api/types';
import { fromKg, type WeightUnit } from '../lib/units';

/**
 * Exportación del historial para análisis fuera de la app: una fila por serie
 * en CSV (lo que pide una hoja de cálculo) y el JSON completo tal cual.
 *
 * El CSV puede salir en kg (unidad canónica del backend) o en la unidad que el
 * usuario tenga elegida en la app; la columna `unidad` lo deja explícito.
 */
const COLUMNAS = [
  'fecha',
  'sesion_id',
  'sesion',
  'ejercicio',
  'grupo_muscular',
  'serie',
  'unidad',
  'peso_previsto',
  'peso_real',
  'reps_previstas',
  'reps_reales',
  'dif',
  'rpe',
  'calentamiento',
  'duracion_min',
  'volumen_sesion',
];

function celda(valor: unknown): string {
  const texto = valor === null || valor === undefined ? '' : String(valor);
  if (/[",\n;]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

const peso = (valorKg: number, unit: WeightUnit): number =>
  unit === 'kg' ? valorKg : Math.round(fromKg(valorKg, unit) * 10) / 10;

export function buildHistoryCsv(datos: HistoryExportResponse, unit: WeightUnit = 'kg'): string {
  const filas: string[] = [COLUMNAS.join(',')];
  for (const sesion of datos.sessions) {
    for (const ejercicio of sesion.exercises) {
      for (const serie of ejercicio.sets) {
        const previsto = serie.planned_weight_kg;
        const real = peso(serie.weight_kg, unit);
        const diferencia = previsto === null || previsto === undefined
          ? ''
          : Number((real - peso(previsto, unit)).toFixed(2));
        filas.push([
          sesion.date ?? '',
          sesion.id,
          sesion.name,
          ejercicio.exercise_name,
          ejercicio.muscle_group ?? '',
          serie.set_number,
          unit,
          previsto === null || previsto === undefined ? '' : peso(previsto, unit),
          real,
          serie.planned_reps ?? '',
          serie.reps,
          diferencia,
          serie.rpe ?? '',
          serie.is_warmup ? 'si' : 'no',
          sesion.duration_min ?? '',
          peso(sesion.total_tonnage_kg, unit),
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
