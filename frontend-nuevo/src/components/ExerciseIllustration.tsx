import type { ReactNode } from 'react';

/*
 * Dibujos propios de inicio/fin de movimiento (T-28). No se copia ningún asset
 * del reloj: son figuras esquemáticas de línea dibujadas aquí, por patrón de
 * movimiento. Un ejercicio sin patrón conocido se declara sin dibujo en vez de
 * enseñar uno que no corresponde.
 */

export type ExercisePattern =
  | 'press'
  | 'pushup'
  | 'overhead'
  | 'lateral'
  | 'row'
  | 'pulldown'
  | 'curl'
  | 'triceps'
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'leg_press'
  | 'leg_curl'
  | 'glute_bridge'
  | 'calf'
  | 'core'
  | 'total';

const STROKE = {
  fill: 'none',
  stroke: 'var(--ga-ink-muted)',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};
const EQUIPMENT = {
  fill: 'none',
  stroke: 'var(--ga-accent)',
  strokeWidth: 2.2,
  strokeLinecap: 'round' as const,
};
const HEAD = { fill: 'var(--ga-ink-muted)', stroke: 'none' };

function Head({ cx, cy }: { cx: number; cy: number }) {
  return <circle cx={cx} cy={cy} r={5} {...HEAD} />;
}

/** Dos posiciones del mismo patrón, dibujadas en 100×80. */
const PATTERNS: Record<ExercisePattern, { start: ReactNode; end: ReactNode }> = {
  press: {
    start: (
      <g>
        <line x1="14" y1="58" x2="86" y2="58" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <line x1="20" y1="52" x2="70" y2="52" {...STROKE} />
        <circle cx="18" cy="49" r="4" {...HEAD} />
        <line x1="44" y1="52" x2="44" y2="36" {...STROKE} />
        <line x1="30" y1="36" x2="58" y2="36" {...EQUIPMENT} />
        <line x1="70" y1="52" x2="80" y2="64" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="14" y1="58" x2="86" y2="58" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <line x1="20" y1="52" x2="70" y2="52" {...STROKE} />
        <circle cx="18" cy="49" r="4" {...HEAD} />
        <line x1="44" y1="52" x2="44" y2="20" {...STROKE} />
        <line x1="30" y1="20" x2="58" y2="20" {...EQUIPMENT} />
        <line x1="70" y1="52" x2="80" y2="64" {...STROKE} />
      </g>
    ),
  },
  pushup: {
    start: (
      <g>
        <line x1="12" y1="64" x2="88" y2="64" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <circle cx="22" cy="40" r="4" {...HEAD} />
        <line x1="26" y1="42" x2="58" y2="46" {...STROKE} />
        <line x1="58" y1="46" x2="78" y2="62" {...STROKE} />
        <line x1="38" y1="44" x2="36" y2="58" {...STROKE} />
        <line x1="42" y1="45" x2="40" y2="58" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="12" y1="64" x2="88" y2="64" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <circle cx="28" cy="50" r="4" {...HEAD} />
        <line x1="32" y1="52" x2="60" y2="56" {...STROKE} />
        <line x1="60" y1="56" x2="78" y2="62" {...STROKE} />
        <line x1="40" y1="53" x2="42" y2="58" {...STROKE} />
        <line x1="44" y1="54" x2="46" y2="58" {...STROKE} />
      </g>
    ),
  },
  overhead: {
    start: (
      <g>
        <line x1="50" y1="16" x2="50" y2="44" {...STROKE} />
        <Head cx={50} cy={13} />
        <line x1="50" y1="24" x2="36" y2="34" {...STROKE} />
        <line x1="50" y1="24" x2="64" y2="34" {...STROKE} />
        <line x1="30" y1="34" x2="70" y2="34" {...EQUIPMENT} />
        <line x1="50" y1="44" x2="40" y2="64" {...STROKE} />
        <line x1="50" y1="44" x2="60" y2="64" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="50" y1="22" x2="50" y2="46" {...STROKE} />
        <Head cx={50} cy={18} />
        <line x1="50" y1="28" x2="40" y2="12" {...STROKE} />
        <line x1="50" y1="28" x2="60" y2="12" {...STROKE} />
        <line x1="30" y1="10" x2="70" y2="10" {...EQUIPMENT} />
        <line x1="50" y1="46" x2="40" y2="66" {...STROKE} />
        <line x1="50" y1="46" x2="60" y2="66" {...STROKE} />
      </g>
    ),
  },
  lateral: {
    start: (
      <g>
        <line x1="50" y1="20" x2="50" y2="48" {...STROKE} />
        <Head cx={50} cy={16} />
        <line x1="50" y1="28" x2="42" y2="46" {...STROKE} />
        <line x1="50" y1="28" x2="58" y2="46" {...STROKE} />
        <line x1="42" y1="46" x2="40" y2="52" {...EQUIPMENT} />
        <line x1="58" y1="46" x2="60" y2="52" {...EQUIPMENT} />
      </g>
    ),
    end: (
      <g>
        <line x1="50" y1="20" x2="50" y2="48" {...STROKE} />
        <Head cx={50} cy={16} />
        <line x1="50" y1="28" x2="24" y2="30" {...STROKE} />
        <line x1="50" y1="28" x2="76" y2="30" {...STROKE} />
        <line x1="24" y1="30" x2="20" y2="34" {...EQUIPMENT} />
        <line x1="76" y1="30" x2="80" y2="34" {...EQUIPMENT} />
      </g>
    ),
  },
  row: {
    start: (
      <g>
        <line x1="30" y1="18" x2="30" y2="46" {...STROKE} />
        <Head cx={30} cy={14} />
        <line x1="30" y1="30" x2="48" y2="40" {...STROKE} />
        <line x1="48" y1="40" x2="48" y2="58" {...STROKE} />
        <line x1="40" y1="58" x2="56" y2="58" {...EQUIPMENT} />
        <line x1="30" y1="46" x2="42" y2="64" {...STROKE} />
        <line x1="30" y1="46" x2="20" y2="64" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="30" y1="20" x2="30" y2="48" {...STROKE} />
        <Head cx={30} cy={16} />
        <line x1="30" y1="32" x2="48" y2="34" {...STROKE} />
        <line x1="48" y1="34" x2="42" y2="44" {...STROKE} />
        <line x1="34" y1="44" x2="50" y2="44" {...EQUIPMENT} />
        <line x1="30" y1="48" x2="42" y2="66" {...STROKE} />
        <line x1="30" y1="48" x2="20" y2="66" {...STROKE} />
      </g>
    ),
  },
  pulldown: {
    start: (
      <g>
        <line x1="24" y1="14" x2="76" y2="14" {...EQUIPMENT} />
        <line x1="34" y1="14" x2="34" y2="22" {...STROKE} />
        <line x1="66" y1="14" x2="66" y2="22" {...STROKE} />
        <Head cx={50} cy={24} />
        <line x1="50" y1="30" x2="50" y2="54" {...STROKE} />
        <line x1="50" y1="40" x2="34" y2="22" {...STROKE} />
        <line x1="50" y1="40" x2="66" y2="22" {...STROKE} />
        <line x1="50" y1="54" x2="42" y2="68" {...STROKE} />
        <line x1="50" y1="54" x2="58" y2="68" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="24" y1="14" x2="76" y2="14" {...EQUIPMENT} />
        <line x1="40" y1="14" x2="40" y2="26" {...STROKE} />
        <line x1="60" y1="14" x2="60" y2="26" {...STROKE} />
        <Head cx={50} cy={28} />
        <line x1="50" y1="34" x2="50" y2="56" {...STROKE} />
        <line x1="50" y1="40" x2="40" y2="38" {...STROKE} />
        <line x1="50" y1="40" x2="60" y2="38" {...STROKE} />
        <line x1="50" y1="56" x2="42" y2="70" {...STROKE} />
        <line x1="50" y1="56" x2="58" y2="70" {...STROKE} />
      </g>
    ),
  },
  curl: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="48" {...STROKE} />
        <line x1="50" y1="28" x2="62" y2="44" {...STROKE} />
        <line x1="58" y1="44" x2="64" y2="52" {...EQUIPMENT} />
        <line x1="50" y1="48" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="48" x2="58" y2="66" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="48" {...STROKE} />
        <line x1="50" y1="28" x2="60" y2="28" {...STROKE} />
        <line x1="56" y1="30" x2="64" y2="32" {...EQUIPMENT} />
        <line x1="50" y1="48" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="48" x2="58" y2="66" {...STROKE} />
      </g>
    ),
  },
  triceps: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="48" {...STROKE} />
        <line x1="50" y1="28" x2="34" y2="20" {...STROKE} />
        <line x1="34" y1="20" x2="36" y2="36" {...STROKE} />
        <line x1="32" y1="38" x2="40" y2="38" {...EQUIPMENT} />
        <line x1="50" y1="48" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="48" x2="58" y2="66" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="48" {...STROKE} />
        <line x1="50" y1="28" x2="34" y2="20" {...STROKE} />
        <line x1="34" y1="20" x2="34" y2="40" {...STROKE} />
        <line x1="30" y1="42" x2="38" y2="42" {...EQUIPMENT} />
        <line x1="50" y1="48" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="48" x2="58" y2="66" {...STROKE} />
      </g>
    ),
  },
  squat: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="46" {...STROKE} />
        <line x1="32" y1="26" x2="68" y2="26" {...EQUIPMENT} />
        <line x1="50" y1="46" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="46" x2="58" y2="66" {...STROKE} />
        <line x1="34" y1="68" x2="46" y2="68" {...STROKE} />
        <line x1="54" y1="68" x2="66" y2="68" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={50} cy={24} />
        <line x1="50" y1="29" x2="50" y2="48" {...STROKE} />
        <line x1="32" y1="34" x2="68" y2="34" {...EQUIPMENT} />
        <line x1="50" y1="48" x2="34" y2="56" {...STROKE} />
        <line x1="50" y1="48" x2="66" y2="56" {...STROKE} />
        <line x1="34" y1="56" x2="30" y2="68" {...STROKE} />
        <line x1="66" y1="56" x2="70" y2="68" {...STROKE} />
      </g>
    ),
  },
  hinge: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="46" {...STROKE} />
        <line x1="34" y1="46" x2="66" y2="46" {...EQUIPMENT} />
        <line x1="50" y1="46" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="46" x2="58" y2="66" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={30} cy={26} />
        <line x1="30" y1="30" x2="50" y2="46" {...STROKE} />
        <line x1="50" y1="46" x2="64" y2="26" {...STROKE} />
        <line x1="62" y1="26" x2="74" y2="26" {...STROKE} />
        <line x1="50" y1="46" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="46" x2="58" y2="66" {...STROKE} />
        <line x1="28" y1="58" x2="52" y2="58" {...EQUIPMENT} />
      </g>
    ),
  },
  lunge: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="46" {...STROKE} />
        <line x1="50" y1="46" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="46" x2="58" y2="66" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={50} cy={18} />
        <line x1="50" y1="23" x2="50" y2="44" {...STROKE} />
        <line x1="50" y1="44" x2="34" y2="52" {...STROKE} />
        <line x1="34" y1="52" x2="30" y2="66" {...STROKE} />
        <line x1="50" y1="44" x2="66" y2="58" {...STROKE} />
        <line x1="66" y1="58" x2="74" y2="66" {...STROKE} />
      </g>
    ),
  },
  leg_press: {
    start: (
      <g>
        <line x1="20" y1="58" x2="20" y2="24" {...STROKE} />
        <Head cx={26} cy={30} />
        <line x1="32" y1="32" x2="32" y2="54" {...STROKE} />
        <line x1="32" y1="54" x2="56" y2="50" {...STROKE} />
        <line x1="56" y1="50" x2="68" y2="36" {...STROKE} />
        <line x1="68" y1="36" x2="68" y2="58" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="20" y1="58" x2="20" y2="24" {...STROKE} />
        <Head cx={26} cy={30} />
        <line x1="32" y1="32" x2="32" y2="54" {...STROKE} />
        <line x1="32" y1="54" x2="60" y2="58" {...STROKE} />
        <line x1="60" y1="58" x2="74" y2="48" {...STROKE} />
      </g>
    ),
  },
  leg_curl: {
    start: (
      <g>
        <line x1="14" y1="58" x2="86" y2="58" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <Head cx={20} cy={46} />
        <line x1="24" y1="48" x2="60" y2="52" {...STROKE} />
        <line x1="60" y1="52" x2="66" y2="58" {...STROKE} />
        <line x1="66" y1="58" x2="76" y2="50" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="14" y1="58" x2="86" y2="58" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <Head cx={20} cy={46} />
        <line x1="24" y1="48" x2="60" y2="52" {...STROKE} />
        <line x1="60" y1="52" x2="70" y2="40" {...STROKE} />
        <line x1="70" y1="40" x2="78" y2="46" {...STROKE} />
      </g>
    ),
  },
  glute_bridge: {
    start: (
      <g>
        <line x1="14" y1="60" x2="86" y2="60" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <Head cx={20} cy={54} />
        <line x1="24" y1="56" x2="58" y2="58" {...STROKE} />
        <line x1="58" y1="58" x2="54" y2="40" {...STROKE} />
        <line x1="54" y1="40" x2="66" y2="60" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="14" y1="60" x2="86" y2="60" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <Head cx={20} cy={54} />
        <line x1="24" y1="56" x2="58" y2="58" {...STROKE} />
        <line x1="58" y1="58" x2="58" y2="42" {...STROKE} />
        <line x1="58" y1="42" x2="70" y2="60" {...STROKE} />
      </g>
    ),
  },
  calf: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="46" {...STROKE} />
        <line x1="50" y1="46" x2="42" y2="66" {...STROKE} />
        <line x1="50" y1="46" x2="58" y2="66" {...STROKE} />
        <line x1="38" y1="68" x2="48" y2="68" {...STROKE} />
        <line x1="54" y1="68" x2="64" y2="68" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="46" {...STROKE} />
        <line x1="50" y1="46" x2="42" y2="62" {...STROKE} />
        <line x1="50" y1="46" x2="58" y2="62" {...STROKE} />
        <line x1="38" y1="62" x2="48" y2="62" {...STROKE} />
        <line x1="54" y1="62" x2="64" y2="62" {...STROKE} />
      </g>
    ),
  },
  core: {
    start: (
      <g>
        <line x1="12" y1="62" x2="88" y2="62" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <Head cx={22} cy={42} />
        <line x1="26" y1="44" x2="58" y2="50" {...STROKE} />
        <line x1="58" y1="50" x2="76" y2="62" {...STROKE} />
        <line x1="40" y1="46" x2="40" y2="62" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <line x1="12" y1="62" x2="88" y2="62" stroke="var(--ga-line-strong)" strokeWidth="3" />
        <Head cx={28} cy={36} />
        <line x1="32" y1="38" x2="58" y2="52" {...STROKE} />
        <line x1="58" y1="52" x2="76" y2="62" {...STROKE} />
        <line x1="44" y1="42" x2="44" y2="62" {...STROKE} />
      </g>
    ),
  },
  total: {
    start: (
      <g>
        <Head cx={50} cy={14} />
        <line x1="50" y1="19" x2="50" y2="44" {...STROKE} />
        <line x1="50" y1="28" x2="36" y2="38" {...STROKE} />
        <line x1="50" y1="28" x2="64" y2="38" {...STROKE} />
        <line x1="50" y1="44" x2="40" y2="64" {...STROKE} />
        <line x1="50" y1="44" x2="60" y2="64" {...STROKE} />
      </g>
    ),
    end: (
      <g>
        <Head cx={50} cy={20} />
        <line x1="50" y1="25" x2="50" y2="48" {...STROKE} />
        <line x1="50" y1="32" x2="34" y2="20" {...STROKE} />
        <line x1="50" y1="32" x2="66" y2="20" {...STROKE} />
        <line x1="50" y1="48" x2="36" y2="58" {...STROKE} />
        <line x1="50" y1="48" x2="64" y2="58" {...STROKE} />
        <line x1="36" y1="58" x2="32" y2="68" {...STROKE} />
        <line x1="64" y1="58" x2="68" y2="68" {...STROKE} />
      </g>
    ),
  },
};

const PATTERN_LABELS: Record<ExercisePattern, string> = {
  press: 'Press horizontal',
  pushup: 'Flexión / fondo',
  overhead: 'Press vertical',
  lateral: 'Elevación lateral',
  row: 'Remo',
  pulldown: 'Tracción vertical',
  curl: 'Curl de bíceps',
  triceps: 'Extensión de tríceps',
  squat: 'Sentadilla',
  hinge: 'Peso muerto / bisagra',
  lunge: 'Zancada',
  leg_press: 'Prensa',
  leg_curl: 'Curl femoral',
  glute_bridge: 'Puente de glúteo',
  calf: 'Gemelo',
  core: 'Core',
  total: 'Cuerpo completo',
};

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Elige el patrón visual por el enum del reloj y, si no, por nombre. */
export function exercisePattern(name: string, watchEnum?: string | null): ExercisePattern | null {
  const enumValue = (watchEnum ?? '').toUpperCase();
  if (enumValue) {
    if (enumValue.includes('BENCH_PRESS') || enumValue.includes('CHEST_FLY') || enumValue.includes('PEC')) return 'press';
    if (enumValue.includes('PUSH_UP') || enumValue.includes('DIP')) return 'pushup';
    if (enumValue.includes('SHOULDER_PRESS') || enumValue.includes('OVERHEAD_PRESS')) return 'overhead';
    if (enumValue.includes('LATERAL_RAISE') || enumValue.includes('REAR_DELT')) return 'lateral';
    if (enumValue.includes('PULLDOWN') || enumValue.includes('PULL_UP') || enumValue.includes('CHIN_UP')) return 'pulldown';
    if (enumValue.includes('ROW') || enumValue.includes('FACE_PULL')) return 'row';
    if (enumValue.includes('CURL') && !enumValue.includes('LEG_CURL')) return 'curl';
    if (enumValue.includes('TRICEPS') || enumValue.includes('PRESSDOWN') || enumValue.includes('KICKBACK')) return 'triceps';
    if (enumValue.includes('SQUAT') || enumValue.includes('LEG_EXTENSION')) return 'squat';
    if (enumValue.includes('DEADLIFT') || enumValue.includes('HINGE')) return 'hinge';
    if (enumValue.includes('LUNGE') || enumValue.includes('SPLIT_SQUAT')) return 'lunge';
    if (enumValue.includes('LEG_PRESS')) return 'leg_press';
    if (enumValue.includes('LEG_CURL') || enumValue.includes('HAMSTRING_CURL')) return 'leg_curl';
    if (enumValue.includes('GLUTE_BRIDGE') || enumValue.includes('HIP_THRUST')) return 'glute_bridge';
    if (enumValue.includes('CALF_RAISE')) return 'calf';
    if (enumValue.includes('PLANK') || enumValue.includes('CRUNCH') || enumValue.includes('SIT_UP') || enumValue.includes('RUSSIAN_TWIST')) return 'core';
    if (enumValue.includes('BURPEE') || enumValue.includes('KETTLEBELL_SWING')) return 'total';
  }
  const value = normalize(name);
  if (/press (de )?banca|press inclinado|press con mancuernas|press en maquina|aperturas/.test(value)) return 'press';
  if (/flexiones|fondos/.test(value)) return 'pushup';
  if (/press militar|press arnold|elevaciones frontales/.test(value)) return 'overhead';
  if (/elevaciones laterales|pajaros/.test(value)) return 'lateral';
  if (/jalon|dominadas/.test(value)) return 'pulldown';
  if (/remo|face pull/.test(value)) return 'row';
  if (/curl (de )?biceps|curl martillo|curl en polea|curl predicador/.test(value)) return 'curl';
  if (/triceps|patada de triceps/.test(value)) return 'triceps';
  if (/sentadilla|extension de cuadriceps/.test(value)) return 'squat';
  if (/peso muerto|hip thrust/.test(value)) return 'hinge';
  if (/zancada|bulgara/.test(value)) return 'lunge';
  if (/prensa/.test(value)) return 'leg_press';
  if (/curl femoral/.test(value)) return 'leg_curl';
  if (/puente de gluteo|patada de gluteo/.test(value)) return 'glute_bridge';
  if (/gemelos/.test(value)) return 'calf';
  if (/plancha|crunch|elevacion de piernas|rueda abdominal|russian twist/.test(value)) return 'core';
  if (/burpee|kettlebell swing/.test(value)) return 'total';
  return null;
}

export function ExerciseIllustration({
  name,
  watchEnum,
  muscleGroup,
  compact = false,
}: {
  name: string;
  watchEnum?: string | null;
  muscleGroup?: string;
  compact?: boolean;
}) {
  const pattern = exercisePattern(name, watchEnum);
  if (pattern === null) {
    return (
      <p className="text-caption text-ink-faint">
        Sin dibujo para «{name}»{muscleGroup ? ` (${muscleGroup})` : ''}: se muestra el nombre porque no hay un
        patrón visual fiable para este ejercicio.
      </p>
    );
  }
  const frames = PATTERNS[pattern];
  return (
    <figure className="m-0">
      <div
        className={`flex items-center gap-3 rounded-md border border-line bg-raised ${compact ? 'p-2' : 'p-3'}`}
        role="img"
        aria-label={`Dibujo de ${name}: posición inicial y final (${PATTERN_LABELS[pattern]})`}
      >
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 100 80" className={compact ? 'h-14 w-20' : 'h-20 w-24'}>
            {frames.start}
          </svg>
          <span className="text-caption text-ink-faint">Inicio</span>
        </div>
        <span aria-hidden="true" className="text-ink-faint">→</span>
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 100 80" className={compact ? 'h-14 w-20' : 'h-20 w-24'}>
            {frames.end}
          </svg>
          <span className="text-caption text-ink-faint">Fin</span>
        </div>
      </div>
      <figcaption className="mt-1 text-caption text-ink-faint">{PATTERN_LABELS[pattern]}</figcaption>
    </figure>
  );
}
