#!/usr/bin/env node
/**
 * La escala de espaciado del sistema de diseño es 4/8/12/16/24/32/48: en
 * Tailwind eso son los pasos 1, 2, 3, 4, 6, 8 y 12. Este check falla si una
 * pantalla usa un padding/margen/gap fuera de esa escala, para que la escala no
 * se quede en el tokens.json mientras la interfaz inventa números.
 *
 * Se exceptúan los tamaños de layout (lateral, contenido, barra inferior), que
 * viven como tokens y se usan con `var(--ga-space-*)`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(here, '..', 'src');
const ALLOWED = new Set(['0', '1', '2', '3', '4', '6', '8', '12']);
const PREFIXES = ['p', 'px', 'py', 'pt', 'pb', 'pl', 'pr', 'm', 'mx', 'my', 'mt', 'mb', 'ml', 'mr', 'gap', 'space-x', 'space-y'];
const PATTERN = new RegExp(`(?:^|[\\s"'\\\`:])((?:${PREFIXES.join('|')})-(\\d+))(?:[\\s"'\\\`]|$)`, 'g');

const files = [];
function walk(directory) {
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(ts|tsx|css)$/.test(entry) && !full.includes(`${join('src', 'test')}`)) files.push(full);
  }
}
walk(srcRoot);

const violations = [];
for (const file of files) {
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, index) => {
    for (const match of line.matchAll(PATTERN)) {
      const step = match[2];
      if (!ALLOWED.has(step)) {
        violations.push(`${relative(srcRoot, file)}:${index + 1}  ${match[1]}  → fuera de 4/8/12/16/24/32/48`);
      }
    }
  });
}

if (violations.length > 0) {
  console.error(`Escala de espaciado: ${violations.length} uso(s) fuera de la escala.`);
  for (const violation of violations) console.error(`- ${violation}`);
  process.exit(1);
}
console.log(`Escala de espaciado: ${files.length} fichero(s), usos dentro de 4/8/12/16/24/32/48.`);
