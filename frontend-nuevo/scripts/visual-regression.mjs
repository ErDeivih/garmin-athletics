#!/usr/bin/env node
/**
 * Regresión visual del gimnasio móvil:
 * - pesos por serie editables con − / + (y guardado real en la API);
 * - envío al reloj con estado enviado;
 * - registro guardado y corrección posterior.
 *
 * Uso: node scripts/visual-regression.mjs [appUrl] [apiUrl]
 * Requiere backend y Vite levantados, como el humo.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

const APP = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '');
const API = (process.argv[3] ?? 'http://127.0.0.1:8010').replace(/\/$/, '');
const here = dirname(fileURLToPath(import.meta.url));
const shots = join(here, '..', 'screenshots');
const currentDir = join(shots, 'visual');
const baselineDir = join(shots, 'visual-baseline');
mkdirSync(currentDir, { recursive: true });
mkdirSync(baselineDir, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
];
const executablePath = chromeCandidates.filter(Boolean).find((candidate) => existsSync(candidate));
if (!executablePath) throw new Error('No hay Chrome/Edge para la regresión visual.');

const stamp = Date.now();
const email = process.env.VISUAL_EMAIL ?? `visual+${stamp}@example.com`;
const password = process.env.VISUAL_PASSWORD ?? 'secreto-123';
const headers = { 'Content-Type': 'application/json' };

async function createFixture() {
  const registration = await fetch(`${API}/api/v1/auth/register`, {
    method: 'POST', headers,
    body: JSON.stringify({ email, username: `visual${stamp}`, display_name: 'Atleta visual', password }),
  });
  if (registration.status !== 201) throw new Error(`Registro visual: ${registration.status} ${await registration.text()}`);
  const { access_token: token } = await registration.json();
  const auth = { ...headers, Authorization: `Bearer ${token}` };
  const exercises = await (await fetch(`${API}/api/v1/strength/exercises?q=press`, { headers: auth })).json();
  const exercise = exercises.items.find((item) => item.slug === 'press-banca-barra') ?? exercises.items[0];
  if (!exercise) throw new Error('Falta press de banca en el catálogo.');
  const targets = [
    { set_number: 1, reps: 8, weight_kg: 40 },
    { set_number: 2, reps: 8, weight_kg: 42.5 },
    { set_number: 3, reps: 6, weight_kg: 45 },
  ];
  const templateResponse = await fetch(`${API}/api/v1/strength/templates`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      name: 'Empuje visual', weekday: (new Date().getDay() + 6) % 7, focus: 'push',
      exercises: [{ exercise_id: exercise.id, sets: 3, reps: 8, weight_kg: 40, rest_seconds: 120, set_targets: targets }],
    }),
  });
  if (templateResponse.status !== 201) throw new Error(`Plantilla visual: ${templateResponse.status} ${await templateResponse.text()}`);
  const template = await templateResponse.json();
  const sessionResponse = await fetch(`${API}/api/v1/strength/sessions`, {
    method: 'POST', headers: auth,
    body: JSON.stringify({
      name: 'Empuje visual', template_id: template.id,
      started_at: '2026-11-08T18:00:00', finished_at: '2026-11-08T18:50:00',
      sets: [
        { exercise_id: exercise.id, set_number: 1, weight_kg: 40, reps: 8 },
        { exercise_id: exercise.id, set_number: 2, weight_kg: 42.5, reps: 8 },
        { exercise_id: exercise.id, set_number: 3, weight_kg: 45, reps: 6 },
      ],
    }),
  });
  if (sessionResponse.status !== 201) throw new Error(`Sesión visual: ${sessionResponse.status} ${await sessionResponse.text()}`);
  const session = await sessionResponse.json();
  return { template, session, exercise, auth };
}

const browser = await chromium.launch({ executablePath, headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 1000 }, deviceScaleFactor: 2 });

const comparisons = [];
async function capture(name, selectorsToMask = []) {
  await page.waitForTimeout(250);
  const current = join(currentDir, `${name}.png`);
  const baseline = join(baselineDir, `${name}.png`);
  await page.screenshot({ path: current, fullPage: false });
  if (!existsSync(baseline)) {
    copyFileSync(current, baseline);
    comparisons.push({ name, status: 'baseline' });
    return;
  }
  const a = PNG.sync.read(readFileSync(baseline));
  const b = PNG.sync.read(readFileSync(current));
  if (a.width !== b.width || a.height !== b.height) {
    comparisons.push({ name, status: 'size-mismatch', expected: `${a.width}x${a.height}`, actual: `${b.width}x${b.height}` });
    return;
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const pixels = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.12 });
  const ratio = pixels / (a.width * a.height);
  if (ratio > 0.002) {
    writeFileSync(join(currentDir, `${name}.diff.png`), PNG.sync.write(diff));
    comparisons.push({ name, status: 'diff', pixels, ratio });
  } else {
    comparisons.push({ name, status: 'ok', pixels, ratio });
  }
  for (const selector of selectorsToMask) {
    // reservado para futuras zonas dinámicas
    void selector;
  }
}

try {
  const { template, session, auth } = await createFixture();
  await page.goto(APP, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /^entra en /i }).waitFor();
  await page.getByLabel(/correo/i).fill(email);
  await page.getByLabel(/contraseña/i).fill(password);
  await page.getByRole('button', { name: /^entrar$/i }).click();
  // La primera vez aparece la introducción; se pasa para llegar al panel.
  await page.getByRole('heading', { name: /cómo funciona/i }).waitFor({ timeout: 5000 })
    .then(() => page.getByRole('button', { name: /empezar/i }).click())
    .catch(() => {});
  await page.getByRole('heading', { name: 'Hoy', exact: true }).waitFor({ timeout: 15000 });

  // 1. Planificador: pesos por serie.
  await page.goto(`${APP}/gimnasio/plantillas/${template.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /editar pesos/i }).waitFor();
  await page.getByRole('button', { name: /subir peso serie 1 de press de banca/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 1200 });
  await capture('plan-pesos');
  await page.getByRole('button', { name: /subir peso serie 1 de press de banca/i }).click();
  await page.waitForTimeout(900);
  const updated = await (await fetch(`${API}/api/v1/strength/templates/${template.id}`, { headers: auth })).json();
  if (updated.exercises[0].set_targets[0].weight_kg !== 42.5) {
    throw new Error(`El peso no se guardó: ${updated.exercises[0].set_targets[0].weight_kg}`);
  }

  // 2. Envío desde Lyfta con estado enviado (respuesta simulada).
  await page.route('**/api/v1/strength/push-to-garmin', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      status: 'sent', unmapped_exercises: [], garmin_response: { workoutId: 12345 },
      pushed_to_device: { ok: true }, note: 'Enviado.',
    }),
  }));
  await page.goto(`${APP}/gimnasio`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Gimnasio', exact: true }).waitFor();
  await page.getByRole('button', { name: /^enviar al reloj$/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 1200 });
  await capture('gimnasio-envio');
  await page.getByRole('button', { name: /^enviar al reloj$/i }).click();
  await page.getByText(/enviado a garmin|confirmado por el reloj/i).waitFor({ timeout: 10000 });
  await capture('envio-enviado');

  // 3. Registro guardado y corrección.
  await page.goto(`${APP}/gimnasio/sesiones/${session.id}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: /editar pesos reales/i }).waitFor();
  await page.getByRole('button', { name: /bajar peso serie 1/i }).waitFor();
  await page.setViewportSize({ width: 390, height: 1000 });
  await capture('sesion-guardada');

  // Copias numeradas para la entrega visual.
  for (const [source, number] of [
    ['plan-pesos', '22-regresion-plan'],
    ['envio-enviado', '23-regresion-envio'],
    ['sesion-guardada', '24-regresion-sesion'],
  ]) {
    copyFileSync(join(currentDir, `${source}.png`), join(shots, `${number}.png`));
  }

  const failures = comparisons.filter((item) => ['diff', 'size-mismatch'].includes(item.status));
  console.log(JSON.stringify({ email, screenshots: comparisons, failures: failures.length }, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  await browser.close();
}
