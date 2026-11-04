#!/usr/bin/env node
/**
 * Prueba de humo con un navegador de verdad: registra una cuenta contra el
 * backend de verificación (copia de la BD), entra en la app, recorre Hoy →
 * Gimnasio → Ajustes, enciende la bandera y abre Actividades. Guarda capturas.
 *
 * Uso: node scripts/smoke-browser.mjs [appUrl] [apiUrl]
 */
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const APP = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const API = (process.argv[3] ?? 'http://127.0.0.1:8010').replace(/\/$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(here, '..', 'screenshots');
mkdirSync(shotsDir, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
].filter(Boolean);

const executablePath = chromeCandidates.find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No hay Chrome/Edge instalado para la prueba de humo.');

const stamp = Date.now();
const email = `smoke+${stamp}@example.com`;
const password = 'secreto-123';
const registration = await fetch(`${API}/api/v1/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, username: `smoke${stamp}`, display_name: 'Atleta de prueba', password }),
});
if (registration.status !== 201) {
  throw new Error(`No se pudo crear la cuenta de humo: ${registration.status} ${await registration.text()}`);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));

const steps = [];
const shot = async (name) => {
  // Deja terminar la transición de color (120 ms) para que la captura sea estable.
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(shotsDir, `${name}.png`), fullPage: true });
  steps.push(name);
};

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /entra en garmin athletics/i }).waitFor();
  await shot('01-login');

  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor({ timeout: 15000 });
  // La cuenta de humo es nueva: el panel tiene que llegar al estado vacío real.
  await page.getByText('Sin datos de hoy', { exact: true }).waitFor({ timeout: 15000 });
  await shot('02-hoy-sin-datos');

  await page.getByRole('link', { name: 'Gimnasio' }).click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();
  await shot('03-gimnasio');

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor();
  await page.getByRole('checkbox', { name: /secciones ampliadas/i }).check();
  await page.getByRole('link', { name: 'Actividades' }).click();
  await page.getByRole('heading', { name: 'Actividades', exact: true }).waitFor();
  await shot('04-actividades');

  // Escritorio con la configuración por defecto: la bandera se apaga para que
  // la captura enseñe las tres pestañas visibles reales (Hoy, Gimnasio, Ajustes).
  await page.evaluate(() => localStorage.removeItem('garmin-athletics.extended'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor();
  // Espera a que el panel resuelva las consultas (dato o vacío), no a un esqueleto.
  await page.getByText('Sin datos de hoy', { exact: true }).waitFor({ timeout: 15000 });
  await shot('05-hoy-escritorio');

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Errores en el navegador: ${[...consoleErrors, ...pageErrors].join(' | ')}`);
  }

  console.log(JSON.stringify({ app: APP, api: API, email, screenshots: steps, consoleErrors, pageErrors }, null, 2));
} finally {
  await browser.close();
}
