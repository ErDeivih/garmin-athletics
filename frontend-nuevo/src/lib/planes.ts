import type { WorkoutTemplate } from '../api/types';

/**
 * Exportar e importar planes en JSON.
 *
 * El JSON lleva lo justo para recrear el plan en otra instalación: nombre, día,
 * foco, notas y los ejercicios con sus objetivos por serie. Los ids locales no
 * se exportan (no significan nada fuera de esta base).
 */
export interface PlanExportado {
  version: 1;
  exported_at: string;
  app: string;
  templates: {
    name: string;
    weekday: number | null;
    focus: string | null;
    notes: string | null;
    exercises: {
      exercise_id: string;
      sets: number;
      reps: number;
      weight_kg: number;
      rest_seconds: number;
      set_targets: { set_number: number; reps: number; weight_kg: number }[];
    }[];
  }[];
}

export interface TemplatePayload {
  name: string;
  weekday: number | null;
  focus: string | null;
  notes: string | null;
  exercises: PlanExportado['templates'][number]['exercises'];
}

export function buildPlanExport(templates: WorkoutTemplate[]): PlanExportado {
  return {
    version: 1,
    exported_at: new Date().toISOString(),
    app: 'Lyfta',
    templates: templates.map((template) => ({
      name: template.name,
      weekday: template.weekday,
      focus: template.focus,
      notes: template.notes,
      exercises: template.exercises.map((item) => ({
        exercise_id: item.exercise?.id ?? '',
        sets: item.sets,
        reps: item.reps,
        weight_kg: item.weight_kg,
        rest_seconds: item.rest_seconds,
        set_targets: item.set_targets?.length
          ? item.set_targets
          : Array.from({ length: item.sets }, (_, index) => ({
            set_number: index + 1,
            reps: item.reps,
            weight_kg: item.weight_kg,
          })),
      })),
    })),
  };
}

/** Descarga un JSON con el nombre dado (el navegador lo guarda o lo comparte). */
export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = filename;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  URL.revokeObjectURL(url);
}

/** Convierte lo leído del fichero en cuerpos para `POST /strength/templates`. */
export function parsePlansJson(texto: string): { templates: TemplatePayload[]; error: string | null } {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { templates: [], error: 'El fichero no es un JSON válido.' };
  }
  if (typeof datos !== 'object' || datos === null) {
    return { templates: [], error: 'El JSON no tiene el formato esperado.' };
  }
  const bruto = datos as { version?: unknown; templates?: unknown };
  if (!Array.isArray(bruto.templates) || bruto.templates.length === 0) {
    return { templates: [], error: 'El JSON no contiene planes.' };
  }
  const templates: TemplatePayload[] = [];
  for (const item of bruto.templates) {
    if (typeof item !== 'object' || item === null) {
      return { templates: [], error: 'Hay un plan con formato raro.' };
    }
    const plan = item as Record<string, unknown>;
    if (typeof plan.name !== 'string' || plan.name.trim().length === 0) {
      return { templates: [], error: 'Hay un plan sin nombre.' };
    }
    if (!Array.isArray(plan.exercises) || plan.exercises.length === 0) {
      return { templates: [], error: `El plan «${plan.name}» no tiene ejercicios.` };
    }
    const exercises: TemplatePayload['exercises'] = [];
    for (const ejercicio of plan.exercises) {
      if (typeof ejercicio !== 'object' || ejercicio === null) {
        return { templates: [], error: `El plan «${plan.name}» tiene un ejercicio vacío.` };
      }
      const fila = ejercicio as Record<string, unknown>;
      if (typeof fila.exercise_id !== 'string' || fila.exercise_id.length === 0) {
        return { templates: [], error: `El plan «${plan.name}» tiene un ejercicio sin id.` };
      }
      exercises.push({
        exercise_id: fila.exercise_id,
        sets: Number(fila.sets) || 1,
        reps: Number(fila.reps) || 8,
        weight_kg: Number(fila.weight_kg) || 0,
        rest_seconds: Number(fila.rest_seconds) || 0,
        set_targets: Array.isArray(fila.set_targets)
          ? (fila.set_targets as TemplatePayload['exercises'][number]['set_targets'])
          : [],
      });
    }
    templates.push({
      name: plan.name.trim().slice(0, 150),
      weekday: typeof plan.weekday === 'number' ? plan.weekday : null,
      focus: typeof plan.focus === 'string' ? plan.focus : null,
      notes: typeof plan.notes === 'string' ? plan.notes : null,
      exercises,
    });
  }
  return { templates, error: null };
}
