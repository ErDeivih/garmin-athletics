#!/usr/bin/env node
/**
 * Contraste AA calculado, no estimado (DOCTRINA §2). Lee los tokens del sistema
 * de diseño y comprueba cada par de texto/fondo declarado en sus usage notes.
 *
 * Regla WCAG 2.1 AA: 4.5:1 para texto normal, 3:1 para texto grande (>=24px o
 * >=18.66px bold) y para bordes/anillos/iconos que llevan significado.
 */
import { readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..');
const tokensPath = join(repoRoot, 'designs', 'carga-design-system', 'project', 'tokens.json');
const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
const themes = tokens.color.themes.map((theme) => theme.id);
const first = themes[0];

const colors = Object.fromEntries(
  tokens.color.tokens.map((token) => [
    token.name,
    token.value,
  ]),
);

function value(name, theme) {
  const token = colors[name];
  if (!token) throw new Error(`Token de color inexistente: ${name}`);
  const hex = token[theme] ?? token[first];
  if (!hex) throw new Error(`Token ${name} sin valor en el tema ${theme}`);
  return hex;
}

function luminance(hex) {
  const clean = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(clean)) throw new Error(`Color no hex de 6 dígitos: ${hex}`);
  const channels = [0, 2, 4].map((index) => parseInt(clean.slice(index, index + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function ratio(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// Texto: >=4.5. Marcas (bordes de control, anillo de foco): >=3.
const textPairs = [
  ['ink', 'bg', 4.5],
  ['ink', 'surface', 4.5],
  ['ink', 'raised', 4.5],
  ['ink-muted', 'bg', 4.5],
  ['ink-muted', 'surface', 4.5],
  ['ink-muted', 'raised', 4.5],
  ['ink-faint', 'bg', 4.5],
  ['ink-faint', 'surface', 4.5],
  ['ink-faint', 'raised', 4.5],
  ['accent', 'bg', 4.5],
  ['accent', 'surface', 4.5],
  ['accent', 'raised', 4.5],
  ['accent', 'accent-soft', 4.5],
  ['on-accent', 'accent', 4.5],
  ['success', 'success-soft', 4.5],
  ['success', 'surface', 4.5],
  ['warn', 'warn-soft', 4.5],
  ['warn', 'surface', 4.5],
  ['danger', 'danger-soft', 4.5],
  ['danger', 'surface', 4.5],
  ['info', 'info-soft', 4.5],
  ['info', 'surface', 4.5],
  ['line-strong', 'bg', 3],
  ['line-strong', 'surface', 3],
  ['line-strong', 'raised', 3],
  ['accent', 'bg', 3],
];

// El anillo de foco usa el color de acento sobre las tres superficies; ya está
// arriba. Este bloque queda para recordar que el foco no puede quedar por debajo
// de 3:1 (el par accent/surface ya se comprueba a 4.5).

const failures = [];
let checked = 0;

for (const theme of themes) {
  for (const [foreground, background, minimum] of textPairs) {
    const foregroundValue = value(foreground, theme);
    const backgroundValue = value(background, theme);
    const contrast = ratio(foregroundValue, backgroundValue);
    checked += 1;
    if (contrast < minimum) {
      failures.push(
        `[${theme}] ${foreground} sobre ${background}: ${contrast.toFixed(2)}:1 (mínimo ${minimum}:1) — ${foregroundValue} / ${backgroundValue}`,
      );
    }
  }
}

console.log(
  `Contraste AA: ${checked} pares comprobados en ${themes.length} tema(s) (${relative(repoRoot, tokensPath)}).`,
);
if (failures.length > 0) {
  console.error(`\n${failures.length} par(es) por debajo del mínimo:`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log('Todos los pares declarados cumplen AA.');
