/**
 * Calculadora de discos: reparte un peso objetivo entre la barra y los discos
 * disponibles, siempre en kg (los discos son físicos). Devuelve lo que va a
 * cada lado y lo que no se puede cubrir con el inventario dado.
 */
export const BARRA_KG = 20;
export const DISCOS_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5, 0.25];

export interface RepartoDiscos {
  /** Peso objetivo en kg (redondeado a 2 decimales). */
  objetivoKg: number;
  /** Discos por lado, de mayor a menor. */
  porLado: number[];
  /** Peso que falta por lado con el inventario disponible (0 si cuadra). */
  restoPorLadoKg: number;
  /** Peso total alcanzable con esos discos (barra incluida). */
  alcanzableKg: number;
  /** Mensaje directo para la interfaz. */
  texto: string;
}

const dosDecimales = (valor: number): number => Math.round(valor * 100) / 100;

export function repartirDiscos(
  objetivoKg: number,
  barraKg = BARRA_KG,
  disponibles: number[] = DISCOS_KG,
): RepartoDiscos {
  const objetivo = dosDecimales(Math.max(0, objetivoKg));
  const discos = [...disponibles].filter((disco) => disco > 0).sort((a, b) => b - a);
  const porLadoObjetivo = dosDecimales((objetivo - barraKg) / 2);

  if (!Number.isFinite(objetivo) || objetivo <= 0) {
    return {
      objetivoKg: 0,
      porLado: [],
      restoPorLadoKg: 0,
      alcanzableKg: 0,
      texto: 'Sin peso objetivo',
    };
  }
  if (porLadoObjetivo <= 0) {
    return {
      objetivoKg: objetivo,
      porLado: [],
      restoPorLadoKg: 0,
      alcanzableKg: barraKg,
      texto: objetivo < barraKg ? `Menos que la barra (${barraKg} kg): sin discos` : `Solo barra (${barraKg} kg)`,
    };
  }

  const porLado: number[] = [];
  let restante = porLadoObjetivo;
  for (const disco of discos) {
    while (restante - disco >= -0.001 && porLado.length < 40) {
      porLado.push(disco);
      restante = dosDecimales(restante - disco);
    }
  }

  const restoPorLadoKg = Math.max(0, dosDecimales(restante));
  const alcanzableKg = dosDecimales(barraKg + porLadoObjetivo * 2 - restoPorLadoKg * 2);
  const texto = porLado.length === 0
    ? `Solo barra (${barraKg} kg)`
    : restoPorLadoKg > 0
      ? `${porLado.join(' + ')} por lado · faltan ${restoPorLadoKg} kg por lado`
      : `${porLado.join(' + ')} por lado`;

  return { objetivoKg: objetivo, porLado, restoPorLadoKg, alcanzableKg, texto };
}
