import { useSyncExternalStore } from 'react';
import { formatNumber } from './format';

/**
 * Unidad de peso preferida por el atleta. El backend y el reloj trabajan
 * siempre en **kilogramos**; la unidad solo cambia lo que se ve y se teclea.
 */
export type WeightUnit = 'kg' | 'lb';

const STORAGE_KEY = 'lyfta.units';
const LEGACY_KEYS = ['carga.units', 'pulso.units'];
const LB_PER_KG = 2.2046226218;

const listeners = new Set<() => void>();

export function readWeightUnit(): WeightUnit {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
      ?? LEGACY_KEYS.map((key) => window.localStorage.getItem(key)).find(Boolean);
    return stored === 'lb' ? 'lb' : 'kg';
  } catch {
    return 'kg';
  }
}

export function setWeightUnit(unit: WeightUnit): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, unit);
  } catch {
    // sin almacenamiento: la unidad dura lo que la pestaña
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

export function useWeightUnit(): WeightUnit {
  return useSyncExternalStore(subscribe, readWeightUnit, () => 'kg');
}

/** Paso de los botones − / +: 2,5 kg o 5 lb. */
export function stepFor(unit: WeightUnit): number {
  return unit === 'lb' ? 5 : 2.5;
}

/** Kilogramos → número en la unidad mostrada. */
export function fromKg(kg: number, unit: WeightUnit): number {
  const value = unit === 'lb' ? kg * LB_PER_KG : kg;
  return Math.round(value * 10) / 10;
}

/** Número tecleado en la unidad mostrada → kilogramos. */
export function toKg(value: number, unit: WeightUnit): number {
  const kg = unit === 'lb' ? value / LB_PER_KG : value;
  return Math.round(kg * 100) / 100;
}

/** Peso formateado con su unidad: «60 kg» / «132,3 lb». */
export function formatWeight(kg: number, unit: WeightUnit): string {
  return `${formatNumber(fromKg(kg, unit))} ${unit}`;
}

export const WEIGHT_UNIT_KEY = STORAGE_KEY;
