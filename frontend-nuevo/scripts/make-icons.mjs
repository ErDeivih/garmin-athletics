#!/usr/bin/env node
/**
 * Genera los iconos PNG de la PWA (180, 192, 512 y maskable) a partir de la
 * marca: fondo #0A0E13, «L» de Lyfta en #22D3EE con Barlow Condensed 700.
 *
 * Se rasteriza en Chrome para que el icono del móvil use la misma tipografía
 * que la app. Idempotente: sobrescribe `public/icons/`.
 *
 * Uso: node scripts/make-icons.mjs
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const outDir = join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = '#0A0E13';
const ACCENT = '#22D3EE';

const fontPath = join(root, 'src', 'fonts', 'barlow-condensed-latin-700-normal.woff2');
if (!existsSync(fontPath)) throw new Error(`Falta la tipografía: ${fontPath}`);
const font = readFileSync(fontPath).toString('base64');

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No hay Chrome/Edge instalado para rasterizar los iconos.');

/** Página de un solo icono: `glyph` es la fracción del lienzo que ocupa la letra. */
function html(size, { rounded, glyph }) {
  const radius = rounded ? Math.round(size * 0.22) : 0;
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  @font-face { font-family: 'BarlowCond'; font-weight: 700;
    src: url(data:font/woff2;base64,${font}) format('woff2'); }
  html, body { margin: 0; padding: 0; width: ${size}px; height: ${size}px; background: ${BG}; }
  .icon { width: ${size}px; height: ${size}px; border-radius: ${radius}px; background: ${BG};
    display: flex; align-items: center; justify-content: center; overflow: hidden; }
  .glyph { font-family: 'BarlowCond', system-ui, sans-serif; font-weight: 700;
    font-size: ${Math.round(size * glyph)}px; line-height: 1; color: ${ACCENT};
    letter-spacing: ${-size * 0.01}px; transform: translateY(${-size * 0.02}px); }
</style></head>
<body><div class="icon"><span class="glyph">L</span></div></body></html>`;
}

const trabajos = [
  { file: 'icon-192.png', size: 192, rounded: true, glyph: 0.62 },
  { file: 'icon-512.png', size: 512, rounded: true, glyph: 0.62 },
  // Maskable: el sistema recorta un círculo; la letra se queda en la zona segura.
  { file: 'icon-512-maskable.png', size: 512, rounded: false, glyph: 0.5 },
  // iOS aplica su propia máscara: cuadrado sin esquinas redondeadas.
  { file: 'apple-touch-icon.png', size: 180, rounded: false, glyph: 0.6 },
];

const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage();
  for (const { file, size, rounded, glyph } of trabajos) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(html(size, { rounded, glyph }), { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.screenshot({
      clip: { x: 0, y: 0, width: size, height: size },
      omitBackground: false,
    });
    writeFileSync(join(outDir, file), buffer);
    console.log(`icono ${file} (${size}x${size})`);
  }
} finally {
  await browser.close();
}

console.log(`Iconos en ${outDir}`);
