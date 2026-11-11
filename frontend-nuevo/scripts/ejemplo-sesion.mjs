#!/usr/bin/env node
/**
 * Genera la sesión de ejemplo que se guarda en `docs/ejemplo-sesion/`:
 * plan de 3 series (60 / 65 / 70 kg), sesión hecha en modo enfocado, corrección
 * del peso real de la serie 1 a 62,5 kg y exportación CSV/JSON de esa sesión.
 *
 * Contra la instancia desechable de `deploy/instancia-verificacion.sh`.
 * Uso: node scripts/ejemplo-sesion.mjs [url]
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const here = dirname(fileURLToPath(import.meta.url));
const APP = (process.argv[2] ?? 'http://192.168.1.139:8011').replace(/\/$/, '');
const OUT = join(here, '..', '..', 'docs', 'ejemplo-sesion');
mkdirSync(OUT, { recursive: true });

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

const stamp = Date.now();
const email = `ejemplo+${stamp}@example.com`;
const password = 'secreto-123';
const api = (path) => `${APP}${path}`;

async function apiJson(path, { token, method = 'GET', body } = {}) {
  const response = await fetch(api(path), {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${text}`);
  return json;
}

// ---------- Datos: cuenta, plantilla y marca anterior ----------
const registro = await apiJson('/api/v1/auth/register', {
  method: 'POST',
  body: { email, username: `ejemplo${stamp}`, display_name: 'Sesión de ejemplo', password },
});
const token = registro.access_token;

const catalogo = await apiJson('/api/v1/strength/exercises?q=press%20de%20banca');
const ejercicio = catalogo.items[0];
const nombre = ejercicio.name;

const plantilla = await apiJson('/api/v1/strength/templates', {
  method: 'POST',
  token,
  body: {
    name: 'Empuje ejemplo',
    weekday: (new Date().getDay() + 6) % 7,
    focus: 'push',
    exercises: [{
      exercise_id: ejercicio.id,
      sets: 3,
      reps: 8,
      weight_kg: 60,
      rest_seconds: 45,
      set_targets: [
        { set_number: 1, weight_kg: 60, reps: 8 },
        { set_number: 2, weight_kg: 65, reps: 8 },
        { set_number: 3, weight_kg: 70, reps: 6 },
      ],
    }],
  },
});

// Marca de la semana pasada: la pantalla muestra «Anterior» bajo cada serie.
const haceUnaSemana = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
await apiJson('/api/v1/strength/sessions', {
  method: 'POST',
  token,
  body: {
    name: 'Sesión anterior',
    started_at: haceUnaSemana,
    finished_at: haceUnaSemana,
    sets: [{ exercise_id: ejercicio.id, set_number: 1, weight_kg: 82.5, reps: 6, rest_seconds: 60 }],
  },
});

// ---------- Navegador: sesión completa en modo enfocado ----------
const browser = await chromium.launch({ executablePath, headless: true });
const pagina = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const captura = async (nombreArchivo) => {
  await pagina.screenshot({ path: join(OUT, `${nombreArchivo}.png`), fullPage: false });
};
const capturas = [];
const guardar = async (nombreArchivo) => {
  await captura(nombreArchivo);
  capturas.push(`${nombreArchivo}.png`);
};

try {
  await pagina.goto(`${APP}/login`, { waitUntil: 'domcontentloaded' });
  await pagina.getByLabel(/email|correo/i).fill(email);
  await pagina.getByLabel(/contraseña/i).fill(password);
  await pagina.getByRole('button', { name: /^entrar$/i }).click();
  await pagina.getByRole('heading', { name: /cómo funciona/i }).waitFor({ timeout: 10000 })
    .then(() => pagina.getByRole('button', { name: /empezar/i }).click())
    .catch(() => {});
  await pagina.getByRole('heading', { name: 'Hoy', exact: true }).waitFor({ timeout: 20000 });

  await pagina.goto(`${APP}/gimnasio`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('link', { name: /empezar sesión/i }).click();
  await pagina.getByRole('heading', { name: 'Entrenar', exact: true }).waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: /modo enfocado/i }).click();
  await pagina.getByRole('heading', { name: 'Serie en curso', exact: true }).waitFor({ timeout: 20000 });
  await guardar('01-serie-enfocada');

  for (let serie = 1; serie <= 3; serie += 1) {
    await pagina.getByRole('button', { name: /^serie hecha$/i }).click();
    await pagina.getByText(/registro rápido/i).waitFor({ timeout: 20000 });
    if (serie === 1) await guardar('02-registro-rapido');
    await pagina.getByRole('button', { name: /rpe 8/i }).click();
    await pagina.getByRole('button', { name: /confirmar serie/i }).click();
    if (serie < 3) {
      await pagina.getByRole('button', { name: /saltar descanso/i }).click().catch(() => {});
    }
  }

  await pagina.getByRole('heading', { name: /sesión completada/i }).waitFor({ timeout: 20000 });
  await pagina.getByLabel(/nota \(opcional\)/i).fill('Ejemplo: 60/65/70 con RPE 8 y una corrección posterior.');
  await guardar('03-sesion-completada');
  await pagina.getByRole('button', { name: /terminar y guardar/i }).click();
  await pagina.getByRole('heading', { name: /sesión terminada/i }).waitFor({ timeout: 20000 });

  // Corregir después: la serie 1 pasa de 60 a 62,5 kg (planificado → real).
  await pagina.getByRole('link', { name: /editar pesos reales/i }).click();
  await pagina.getByRole('heading', { name: /editar pesos reales/i }).waitFor({ timeout: 20000 });
  await pagina.getByRole('button', { name: new RegExp(`subir peso serie 1 de ${nombre}`, 'i') }).click();
  await pagina.getByText(/guardado/i).waitFor({ timeout: 20000 });
  await guardar('04-planificado-vs-real');

  await pagina.goto(`${APP}/gimnasio/historial`, { waitUntil: 'domcontentloaded' });
  await pagina.getByRole('heading', { name: 'Historial', exact: true }).waitFor({ timeout: 20000 });
  await guardar('05-historial');
} finally {
  await pagina.close();
  await browser.close();
}

// ---------- Exportación de la sesión de ejemplo ----------
const exportado = await apiJson('/api/v1/strength/export', { token });
const sesion = exportado.sessions.find((item) => item.name === 'Empuje ejemplo');
if (!sesion) throw new Error('No se encontró la sesión de ejemplo en la exportación.');
const filas = sesion.exercises.flatMap((item) => item.sets.map((serie) => ({
  fecha: sesion.date,
  sesion_id: sesion.id,
  sesion: sesion.name,
  ejercicio: item.exercise_name,
  grupo_muscular: item.muscle_group,
  serie: serie.set_number,
  unidad: 'kg',
  peso_previsto: serie.planned_weight_kg,
  peso_real: serie.weight_kg,
  reps_previstas: serie.planned_reps,
  reps_reales: serie.reps,
  dif: serie.planned_weight_kg == null ? '' : Number((serie.weight_kg - serie.planned_weight_kg).toFixed(2)),
  rpe: serie.rpe,
  calentamiento: serie.is_warmup ? 'si' : 'no',
  duracion_min: sesion.duration_min,
  volumen_sesion: sesion.total_tonnage_kg,
})));
const columnas = Object.keys(filas[0]);
const csv = [columnas.join(','), ...filas.map((fila) => columnas.map((columna) => fila[columna] ?? '').join(','))].join('\n') + '\n';
writeFileSync(join(OUT, 'sesion-ejemplo.csv'), csv, 'utf8');
writeFileSync(join(OUT, 'sesion-ejemplo.json'), JSON.stringify({ segunExportacion: sesion, filas }, null, 2), 'utf8');

console.log(JSON.stringify({
  aplicacion: APP,
  capturas,
  csv: filas.map((fila) => `${fila.serie}: ${fila.peso_previsto} -> ${fila.peso_real} kg (${fila.reps_reales} reps, RPE ${fila.rpe})`),
  sesion_id: sesion.id,
  filas: filas.length,
  resultado: 'OK',
}, null, 2));
