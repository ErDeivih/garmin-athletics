#!/usr/bin/env node
/**
 * Captura una URL con el viewport de un móvil. Sirve como evidencia de que el
 * despliegue se ve bien desde fuera (no solo que responde 200).
 *
 * Uso: node scripts/shot-url.mjs <url> <salida.png> [ancho] [alto]
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { chromium } from 'playwright-core';

const [url, out, ancho = '390', alto = '844'] = process.argv.slice(2);
if (!url || !out) {
  console.error('Uso: node scripts/shot-url.mjs <url> <salida.png> [ancho] [alto]');
  process.exit(2);
}

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

mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ executablePath });
try {
  const page = await browser.newPage({ viewport: { width: Number(ancho), height: Number(alto) } });
  const errores = [];
  page.on('console', (msg) => { if (msg.type() === 'error') errores.push(msg.text()); });
  page.on('pageerror', (error) => errores.push(String(error)));
  const respuesta = await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out });
  console.log(JSON.stringify({
    url,
    salida: out,
    status: respuesta?.status(),
    titulo: await page.title(),
    errores,
  }, null, 2));
} finally {
  await browser.close();
}
