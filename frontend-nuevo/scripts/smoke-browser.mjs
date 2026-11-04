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
const providedEmail = process.env.SMOKE_EMAIL;
const providedPassword = process.env.SMOKE_PASSWORD;
const email = providedEmail ?? `smoke+${stamp}@example.com`;
const password = providedPassword ?? 'secreto-123';

if (!providedEmail) {
  const registration = await fetch(`${API}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, username: `smoke${stamp}`, display_name: 'Atleta de prueba', password }),
  });
  if (registration.status !== 201) {
    throw new Error(`No se pudo crear la cuenta de humo: ${registration.status} ${await registration.text()}`);
  }
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
  // El panel resuelve a estado vacío o a datos; en ambos casos hay que esperar
  // a que las consultas terminen antes de capturar.
  await page.getByText(/sin datos de hoy|carga de entrenamiento/i).first().waitFor({ timeout: 15000 });
  const emptyToday = (await page.getByText('Sin datos de hoy', { exact: true }).count()) > 0;
  // Alto de viewport suficiente para que la barra fija no tape el contenido al
  // capturar la página entera. Con datos hay que ver el panel completo; con el
  // estado vacío, basta la pantalla real de móvil.
  await page.setViewportSize({ width: 390, height: emptyToday ? 844 : 2600 });
  await shot(emptyToday ? '02-hoy-sin-datos' : '02-hoy-datos');
  await page.setViewportSize({ width: 390, height: 844 });

  await page.getByRole('link', { name: 'Gimnasio' }).click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();
  await shot('03-gimnasio');

  // T-28: catálogo con dibujos inicio/fin.
  await page.getByRole('link', { name: /catálogo de ejercicios/i }).click();
  await page.getByRole('heading', { name: 'Catálogo', exact: true }).waitFor();
  await page.getByRole('img', { name: /dibujo de press de banca/i }).waitFor({ timeout: 15000 });
  // Filtra para que la captura enseñe los dibujos a tamaño legible.
  await page.getByLabel(/buscar/i).fill('press');
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 1600 });
  await shot('10-catalogo');
  await page.getByLabel(/buscar/i).fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /volver a gimnasio/i }).click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();

  // T-04: empezar la plantilla del día, marcar una serie y terminar la sesión
  // contra el backend real (copia). Esto crea una sesión de verdad.
  await page.getByRole('link', { name: /empezar sesión/i }).click();
  await page.getByRole('heading', { name: 'Entrenar', exact: true }).waitFor();
  await page.getByText(/objetivo 4×8/i).waitFor({ timeout: 15000 });
  await page.getByRole('checkbox', { name: /serie 1 de press de banca/i }).click();
  await page.getByRole('status').filter({ hasText: /descanso/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 2000 });
  await shot('08-entrenar');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /terminar sesión/i }).first().click();
  await page.getByRole('heading', { name: /sesión terminada/i }).waitFor({ timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 2000 });
  await shot('09-resumen-sesion');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /volver a gimnasio/i }).click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor();
  await page.getByRole('checkbox', { name: /secciones ampliadas/i }).check();
  await page.getByRole('link', { name: 'Actividades' }).click();
  await page.getByRole('heading', { name: 'Actividades', exact: true }).waitFor();
  await shot('04-actividades');

  // Tendencias con la ampliación de T-27 (solo visible con la bandera encendida).
  await page.getByRole('link', { name: 'Tendencias' }).click();
  await page.getByRole('heading', { name: 'Tendencias', exact: true }).waitFor();
  await page.getByText(/tss por semana|carga de entrenamiento/i).first().waitFor({ timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 2600 });
  await shot('07-tendencias');
  await page.setViewportSize({ width: 390, height: 844 });

  // Escritorio con la configuración por defecto: la bandera se apaga para que
  // la captura enseñe las tres pestañas visibles reales (Hoy, Gimnasio, Ajustes).
  await page.evaluate(() => localStorage.removeItem('garmin-athletics.extended'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor();
  // Espera a que el panel resuelva las consultas (dato o vacío), no a un esqueleto.
  await page.getByText(/sin datos de hoy|carga de entrenamiento/i).first().waitFor({ timeout: 15000 });
  await shot('05-hoy-escritorio');

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Errores en el navegador: ${[...consoleErrors, ...pageErrors].join(' | ')}`);
  }

  console.log(JSON.stringify({ app: APP, api: API, email, screenshots: steps, consoleErrors, pageErrors }, null, 2));
} finally {
  await browser.close();
}
