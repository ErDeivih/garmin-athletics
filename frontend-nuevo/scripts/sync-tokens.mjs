#!/usr/bin/env node
/* Sin fuente duplicada: los tokens viven en el sistema de diseño y de ahí salen
 *   - designs/lyfta-design-system/project/tokens.css  (lo que leen las previews)
 *   - frontend-nuevo/src/styles/tokens.generated.css              (lo que consume la app)
 *
 * Uso:
 *   node scripts/sync-tokens.mjs            escribe ambos ficheros
 *   node scripts/sync-tokens.mjs --check    falla (exit 1) si alguno está desactualizado
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = join(here, '..');
const repoRoot = join(appRoot, '..');
const dsRoot = join(repoRoot, 'designs', 'lyfta-design-system');
const tokensPath = join(dsRoot, 'project', 'tokens.json');

const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));
const themes = tokens.color.themes;
const first = themes[0].id;
const colorTokens = tokens.color.tokens;
const shadowTokens = (tokens.shadow?.tokens ?? []).filter((t) => t.value && typeof t.value === 'object');

const colorValue = (token, themeId) => {
  const v = token.value[themeId] ?? token.value[first];
  if (!v) throw new Error(`El token ${token.name} no tiene valor en el tema ${themeId}`);
  return v;
};

const lines = [];
lines.push('/* Lyfta — generated from tokens.json */');
lines.push('/* No editar a mano: cambia tokens.json y ejecuta `npm run tokens`. */');
lines.push('');
lines.push(`:root, [data-theme="${first}"] {`);
for (const t of colorTokens) lines.push(`  --${t.name}: ${colorValue(t, first)};`);
for (const t of shadowTokens) lines.push(`  --${t.name}: ${colorValue(t, first)};`);
lines.push('}');
lines.push('');
for (const theme of themes.slice(1)) {
  lines.push(`[data-theme="${theme.id}"] {`);
  for (const t of colorTokens) lines.push(`  --${t.name}: ${colorValue(t, theme.id)};`);
  for (const t of shadowTokens) lines.push(`  --${t.name}: ${colorValue(t, theme.id)};`);
  lines.push('}');
  lines.push('');
}

const familyKey = (style) => {
  const group = tokens.type.groups.find((g) => g.styles.some((s) => s.name === style.name));
  return group ? group.family : 'sans';
};

lines.push(':root {');
for (const t of tokens.spacing.tokens) lines.push(`  --${t.name}: ${t.value};`);
for (const t of tokens.radius.tokens) lines.push(`  --${t.name}: ${t.value};`);
for (const [key, stack] of Object.entries(tokens.type.families)) lines.push(`  --font-${key}: ${stack};`);
lines.push('}');
lines.push('');
for (const t of tokens.type.fonts) {
  lines.push('@font-face {');
  lines.push(`  font-family: "${t.family}";`);
  lines.push(`  src: url("${t.file}") format("woff2");`);
  lines.push(`  font-weight: ${t.weight};`);
  lines.push('  font-style: normal;');
  lines.push('  font-display: swap;');
  lines.push('}');
}
lines.push('');
for (const group of tokens.type.groups) {
  for (const style of group.styles) {
    lines.push(`.${style.name} {`);
    lines.push(`  font-family: var(--font-${familyKey(style)});`);
    lines.push(`  font-size: ${style.fontSize};`);
    lines.push(`  line-height: ${style.lineHeight};`);
    lines.push(`  font-weight: ${style.fontWeight};`);
    if (style.letterSpacing) lines.push(`  letter-spacing: ${style.letterSpacing};`);
    if (style.fontFeature) lines.push(`  font-feature-settings: "${style.fontFeature}" 1;`);
    lines.push('}');
  }
}
lines.push('');

const dsCss = lines.join('\n');

// --- CSS que consume la app: variables + mapeo a Tailwind v4 (@theme inline) ---
const app = [];
app.push('/* Lyfta — generated from tokens.json */');
app.push('/* No editar a mano: cambia tokens.json y ejecuta `npm run tokens`. */');
app.push('');
app.push(`:root, [data-theme="${first}"] {`);
for (const t of colorTokens) app.push(`  --ga-${t.name}: ${colorValue(t, first)};`);
for (const t of shadowTokens) app.push(`  --ga-${t.name}: ${colorValue(t, first)};`);
app.push('}');
app.push('');
for (const theme of themes.slice(1)) {
  app.push(`[data-theme="${theme.id}"] {`);
  for (const t of colorTokens) app.push(`  --ga-${t.name}: ${colorValue(t, theme.id)};`);
  for (const t of shadowTokens) app.push(`  --ga-${t.name}: ${colorValue(t, theme.id)};`);
  app.push('}');
  app.push('');
}
app.push(':root {');
for (const t of tokens.spacing.tokens) app.push(`  --ga-${t.name}: ${t.value};`);
for (const t of tokens.radius.tokens) app.push(`  --ga-${t.name}: ${t.value};`);
for (const [key, stack] of Object.entries(tokens.type.families)) app.push(`  --ga-font-${key}: ${stack};`);
app.push('}');
app.push('');
for (const t of tokens.type.fonts) {
  app.push('@font-face {');
  app.push(`  font-family: "${t.family}";`);
  app.push(`  src: url("../fonts/${t.file.replace(/^fonts\//, '')}") format("woff2");`);
  app.push(`  font-weight: ${t.weight};`);
  app.push('  font-style: normal;');
  app.push('  font-display: swap;');
  app.push('}');
}
app.push('');
app.push('@theme inline {');
for (const t of colorTokens) app.push(`  --color-${t.name}: var(--ga-${t.name});`);
for (const t of shadowTokens) app.push(`  --shadow-${t.name.replace(/^shadow-/, '')}: var(--ga-${t.name});`);
app.push('  --font-sans: var(--ga-font-sans);');
app.push('  --font-display: var(--ga-font-display);');
for (const style of tokens.type.groups.flatMap((g) => g.styles)) {
  app.push(`  --text-${style.name}: ${style.fontSize};`);
  app.push(`  --text-${style.name}--line-height: ${style.lineHeight};`);
  app.push(`  --text-${style.name}--font-weight: ${style.fontWeight};`);
  if (style.letterSpacing) app.push(`  --text-${style.name}--letter-spacing: ${style.letterSpacing};`);
}
for (const t of tokens.radius.tokens) app.push(`  --radius-${t.name.replace(/^radius-/, '')}: ${t.value};`);
// El espaciado no se mapea a Tailwind: su escala por defecto ya es la del sistema
// (1 = 4px, 2 = 8px, 3 = 12px, 4 = 16px, 6 = 24px, 8 = 32px, 12 = 48px).
app.push('}');
app.push('');
app.push('.tnum { font-variant-numeric: tabular-nums; }');
app.push('.focus-ring:focus-visible { outline: none; box-shadow: var(--ga-focus-ring); }');
app.push('');

const appCss = app.join('\n');

const outputs = [
  { path: join(dsRoot, 'project', 'tokens.css'), content: dsCss },
  { path: join(appRoot, 'src', 'styles', 'tokens.generated.css'), content: appCss },
];

const check = process.argv.includes('--check');
let stale = 0;
for (const out of outputs) {
  const current = existsSync(out.path) ? readFileSync(out.path, 'utf8') : '';
  if (current === out.content) {
    console.log(`ok   ${relative(repoRoot, out.path)}`);
    continue;
  }
  stale += 1;
  if (check) {
    console.error(`STALE ${relative(repoRoot, out.path)}`);
  } else {
    writeFileSync(out.path, out.content, 'utf8');
    console.log(`write ${relative(repoRoot, out.path)}`);
  }
}
if (check && stale > 0) {
  console.error('Los tokens generados no coinciden con tokens.json. Ejecuta `npm run tokens`.');
  process.exit(1);
}
console.log(stale === 0 ? 'tokens al día' : `${stale} fichero(s) generado(s)`);
