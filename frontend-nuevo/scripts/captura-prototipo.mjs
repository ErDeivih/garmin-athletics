#!/usr/bin/env node
/**
 * Captura el prototipo HTML de la sesión en curso a 390 × 844 para la galería.
 * Uso: node scripts/captura-prototipo.mjs
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const raiz = join(here, '..', '..');
const prototipo = join(raiz, 'docs', 'prototipo-sesion.html');
const salida = join(raiz, 'docs', 'capturas-movil', '33-prototipo-sesion.png');
mkdirSync(dirname(salida), { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);
const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No hay Chrome/Edge instalado.');
if (!existsSync(prototipo)) throw new Error(`Falta el prototipo: ${prototipo}`);

const browser = await chromium.launch({ executablePath, headless: true });
const pagina = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
try {
  await pagina.goto(pathToFileURL(prototipo).href, { waitUntil: 'load' });
  const visible = await pagina.getByText('65 kg').first().isVisible();
  const cinta = await pagina.getByText(/datos ficticios/i).first().isVisible();
  const alto = await pagina.evaluate(() => document.documentElement.scrollHeight);
  if (!visible || !cinta) throw new Error('El prototipo no muestra la serie grande o la marca de datos ficticios.');
  await pagina.screenshot({ path: salida, fullPage: true });
  console.log(JSON.stringify({ prototipo, captura: salida, serieGrande: visible, datosFicticios: cinta, alto, resultado: 'OK' }, null, 2));
} finally {
  await pagina.close();
  await browser.close();
}
