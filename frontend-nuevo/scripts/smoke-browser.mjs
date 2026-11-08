#!/usr/bin/env node
/**
 * Prueba de humo con un navegador de verdad: registra una cuenta contra el
 * backend de verificación (copia de la BD), entra en la app, recorre Hoy →
 * Gimnasio → Ajustes, enciende la bandera y abre Actividades. Guarda capturas.
 *
 * Uso: node scripts/smoke-browser.mjs [appUrl] [apiUrl]
 */
import { existsSync, mkdirSync, copyFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const APP = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const API = (process.argv[3] ?? 'http://127.0.0.1:8010').replace(/\/$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = process.env.SMOKE_SHOTS_DIR ?? join(here, '..', 'screenshots');
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

  const { access_token: token } = await registration.json();
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const catalogo = await fetch(`${API}/api/v1/strength/exercises?q=press`, { headers });
  if (!catalogo.ok) throw new Error(`No se pudo consultar el catálogo: ${catalogo.status}`);
  const ejercicio = (await catalogo.json()).items.find((item) => item.slug === 'press-banca-barra');
  if (!ejercicio) throw new Error('Falta el press de banca en el catálogo de prueba.');
  const plantilla = await fetch(`${API}/api/v1/strength/templates`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Empuje A',
      weekday: (new Date().getDay() + 6) % 7,
      focus: 'push',
      exercises: [{ exercise_id: ejercicio.id, sets: 4, reps: 8, weight_kg: 40, rest_seconds: 60 }],
    }),
  });
  if (plantilla.status !== 201) throw new Error(`No se pudo crear la plantilla de humo: ${plantilla.status}`);
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const consoleErrors = [];
const pageErrors = [];
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('response', (response) => {
  if (response.status() >= 400) pageErrors.push(`${response.status()} ${response.url()}`);
});
page.on('pageerror', (error) => pageErrors.push(error.message));

const steps = [];
const shot = async (name) => {
  // Deja terminar la transición de color (120 ms) para que la captura sea estable.
  await page.waitForTimeout(250);
  // Chrome escribe primero en temporales: el disco del repo a veces devuelve
  // UNKNOWN al abrir un PNG recién creado (antivirus/escáner). Copiar después
  // con reintentos evita que el humo falle por el sistema de ficheros.
  const tmp = join(tmpdir(), `lyfta-${name}-${Date.now()}.png`);
  await page.screenshot({ path: tmp, fullPage: true });
  const target = join(shotsDir, `${name}.png`);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      copyFileSync(tmp, target);
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await page.waitForTimeout(250);
    }
  }
  try {
    unlinkSync(tmp);
  } catch {
    // el temporal queda en %TEMP%; no afecta a la entrega
  }
  steps.push(name);
};

try {
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /^entra en /i }).waitFor();
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

  // Biblioteca estructurada por foco y fases (T-40).
  await page.getByRole('link', { name: /^biblioteca$/i }).click();
  await page.getByRole('heading', { name: 'Biblioteca', exact: true }).waitFor();
  const firstTemplate = page.getByRole('button').filter({ hasText: /Empuje A/i }).first();
  if ((await firstTemplate.count()) > 0) {
    await firstTemplate.click();
    await page.getByText(/activación/i).first().waitFor({ timeout: 10000 }).catch(() => {});
  }
  await page.setViewportSize({ width: 390, height: 2000 });
  await shot('04-biblioteca');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('main').getByRole('link', { name: /^gimnasio$/i }).click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();

  // T-28: catálogo con dibujos inicio/fin.
  await page.getByRole('link', { name: /^catálogo$/i }).click();
  await page.getByRole('heading', { name: 'Catálogo', exact: true }).waitFor();
  await page.getByRole('img', { name: /dibujo de press de banca/i }).waitFor({ timeout: 15000 });
  // Filtra para que la captura enseñe los dibujos a tamaño legible.
  await page.getByLabel(/buscar/i).fill('press');
  await page.waitForTimeout(300);
  await page.setViewportSize({ width: 390, height: 1600 });
  await shot('05-catalogo');
  // Editor de detección IMU de un ejercicio.
  await page.getByRole('link', { name: /configurar detección/i }).first().click();
  await page.getByRole('heading', { name: /detección de repeticiones/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 1600 });
  await shot('06-deteccion');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /^catálogo$/i }).click();
  await page.getByRole('heading', { name: 'Catálogo', exact: true }).waitFor();
  await page.getByLabel(/buscar/i).fill('');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /volver a gimnasio/i }).click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();

  // Envío desde Lyfta: el botón y su estado, sin depender de Garmin Connect.
  await page.getByRole('button', { name: /^enviar al reloj$/i }).waitFor({ timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 1200 });
  await shot('07-envio-reloj');
  await page.setViewportSize({ width: 390, height: 844 });

  // Planificador móvil: pesos por serie con − / +.
  await page.getByRole('link', { name: /editar pesos/i }).first().click();
  await page.getByRole('heading', { name: /editar pesos/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 1600 });
  await shot('19-editar-plan');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /^gimnasio$/i }).first().click();
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

  // Corrección posterior de pesos reales desde el móvil.
  await page.getByRole('link', { name: /editar pesos reales/i }).click();
  await page.getByRole('heading', { name: /editar pesos reales/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 1600 });
  await shot('20-editar-sesion');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('link', { name: /^gimnasio$/i }).first().click();
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();

  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor();
  await page.getByRole('checkbox', { name: /mostrar todas las secciones/i }).check();
  await page.getByRole('link', { name: 'Actividades' }).click();
  await page.getByRole('heading', { name: 'Actividades', exact: true }).waitFor();
  await shot('10-actividades');

  // Detalle de actividad: filtra Carrera para asegurar una salida con GPS.
  await page.getByRole('button', { name: 'Carrera' }).click();
  await page.waitForTimeout(400);
  const firstActivity = page.locator('a[href^="/actividades/"]').filter({ hasText: /Carrera|Ciclismo|Fútbol/i }).first();
  if ((await firstActivity.count()) > 0) {
    // Elige por API una salida con GPS real, no la primera de la lista.
    const richId = await page.evaluate(async () => {
      const token = window.localStorage.getItem('lyfta.token');
      const response = await fetch('/api/v1/activities/?limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) return null;
      const rows = await response.json();
      return rows.find((row) => row.has_track && /run|carrera/i.test(row.type))?.id
        ?? rows.find((row) => row.has_track)?.id
        ?? null;
    });
    if (richId) {
      await page.goto(`${APP}/actividades/${richId}`, { waitUntil: 'domcontentloaded' });
    } else {
      await firstActivity.click();
    }
    await page.getByRole('img', { name: /recorrido de la actividad/i }).waitFor({ timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.setViewportSize({ width: 390, height: 2400 });
    await shot('11-actividad');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('main').getByRole('link', { name: /^actividades$/i }).click();
    await page.getByRole('heading', { name: 'Actividades', exact: true }).waitFor();
  }

  // Calendario: programar una plantilla semanal y ver la semana.
  await page.getByRole('link', { name: 'Calendario' }).click();
  await page.getByRole('heading', { name: 'Calendario', exact: true }).waitFor();
  await page.getByLabel(/plantilla/i).selectOption({ label: 'Empuje A' }).catch(() => {});
  await page.getByRole('button', { name: /^programar$/i }).click().catch(() => {});
  await page.waitForTimeout(600);
  await page.setViewportSize({ width: 390, height: 2000 });
  await shot('12-calendario');
  await page.setViewportSize({ width: 390, height: 844 });

  // Tendencias con la ampliación de T-27 (solo visible con la bandera encendida).
  await page.getByRole('link', { name: 'Tendencias' }).click();
  await page.getByRole('heading', { name: 'Tendencias', exact: true }).waitFor();
  await page.getByText(/carga semanal|carga de entrenamiento/i).first().waitFor({ timeout: 15000 });
  await page.setViewportSize({ width: 390, height: 2600 });
  await shot('13-tendencias');
  await page.setViewportSize({ width: 390, height: 844 });

  // Resto de pantallas ampliadas y Ajustes con la nueva densidad.
  await page.getByRole('link', { name: 'Ajustes' }).click();
  await page.getByRole('heading', { name: 'Ajustes', exact: true }).waitFor();
  await page.setViewportSize({ width: 390, height: 2000 });
  await shot('14-ajustes');
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [section, name] of [['Rendimiento', '15-rendimiento'], ['Rutas', '16-rutas'], ['Social', '17-social']]) {
    await page.getByRole('link', { name: section }).click();
    await page.getByRole('heading', { name: section, exact: true }).waitFor();
    await page.waitForTimeout(400);
    if (section === 'Rutas') {
      await page.getByRole('button', { name: /generar ruta/i }).click();
      await page.getByText(/ritmo por kilómetro/i).first().waitFor({ timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      await page.setViewportSize({ width: 390, height: 2800 });
    } else {
      await page.setViewportSize({ width: 390, height: 1800 });
    }
    await shot(name);
    await page.setViewportSize({ width: 390, height: 844 });
  }

  // Escritorio con la configuración por defecto: la bandera se apaga para que
  // la captura enseñe las tres pestañas visibles reales (Hoy, Gimnasio, Ajustes).
  await page.evaluate(() => localStorage.removeItem('lyfta.extended'));
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${APP}/`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor();
  // Espera a que el panel resuelva las consultas (dato o vacío), no a un esqueleto.
  await page.getByText(/sin datos de hoy|carga de entrenamiento/i).first().waitFor({ timeout: 15000 });
  await shot('18-hoy-escritorio');

  if (consoleErrors.length > 0 || pageErrors.length > 0) {
    throw new Error(`Errores en el navegador: ${[...consoleErrors, ...pageErrors].join(' | ')}`);
  }

  console.log(JSON.stringify({ app: APP, api: API, email, screenshots: steps, consoleErrors, pageErrors }, null, 2));
} finally {
  await browser.close();
}
